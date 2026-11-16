// SanoEntrenador — Reportes: ingresos, planes, asistencia, alumnos nuevos y retención
import { store, memberStatus, LIVE_STATUS } from '../store.js';
import { esc, usd, num, todayKey, emptyState, toCSV, download, methodLabel } from '../utils.js';
import { icon } from '../icons.js';
import { methodNet } from '../ops.js';
import { printDoc } from '../shared.js';

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const vbars = (rows, fmt = (v) => v, tone = 'brand') => {
  const max = Math.max(1, ...rows.map((r) => r.v));
  return `<div class="vbars">${rows.map((r) => `<div class="vbar ${r.now ? 'now' : ''}" title="${esc(r.l)}: ${esc(fmt(r.v))}"><b>${r.v ? esc(fmt(r.v)) : ''}</b><i class="tone-${tone}" style="height:${Math.max(2, (r.v / max) * 100)}%"></i><span>${esc(r.l)}</span></div>`).join('')}</div>`;
};

export function mount(el) {
  el.innerHTML = `<div class="view-header"><div><h1 class="view-title">Reportes</h1><p class="view-sub">Últimos 6 meses</p></div>
    <div class="view-actions"><button class="btn btn-secondary" data-print>${icon('print')} Imprimir</button><button class="btn btn-secondary" data-csv>${icon('download')} Cobros (CSV)</button></div></div>
    <div data-body><div class="empty"><div class="spinner" style="margin:40px auto"></div></div></div>`;
  let sales = []; let checkins = [];
  (async () => {
    const from = new Date(); from.setMonth(from.getMonth() - 5, 1); from.setHours(0, 0, 0, 0);
    try {
      [sales, checkins] = await Promise.all([store.salesBetween(from.toISOString(), new Date().toISOString()), store.listBetween('checkins', 'date', from.toISOString(), new Date().toISOString())]);
    } catch (e) { const b = el.querySelector('[data-body]'); if (b) b.innerHTML = emptyState('alert', 'No se pudieron cargar los datos', esc(e.message)); return; }
    if (!el.isConnected || !el.querySelector('[data-body]')) return;
    draw(from);
  })();

  function draw(from) {
    const ok = sales.filter((s) => s.status !== 'voided');
    const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(from); d.setMonth(from.getMonth() + i); return { k: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, l: MONTHS[d.getMonth()] }; });
    const curM = todayKey().slice(0, 7);
    const inc = months.map((m) => ({ l: m.l, v: ok.filter((s) => (s.dayKey || '').slice(0, 7) === m.k).reduce((a, s) => a + (s.total || 0), 0), now: m.k === curM }));
    const ses = months.map((m) => ({ l: m.l, v: checkins.filter((c) => (c.dayKey || '').slice(0, 7) === m.k).length, now: m.k === curM }));
    const news = months.map((m) => ({ l: m.l, v: store.members.filter((x) => (x.createdAt || '').slice(0, 7) === m.k).length, now: m.k === curM }));
    const monthSales = ok.filter((s) => (s.dayKey || '').slice(0, 7) === curM);
    const byPlan = {};
    ok.forEach((s) => (s.items || []).forEach((it) => { const k = it.kind === 'servicio' ? it.name : (store.plan(it.planId || s.planId)?.name || it.name.split(' · ')[0].replace(/^Abono: /, '')); byPlan[k] = (byPlan[k] || 0) + (it.total ?? it.price ?? 0); }));
    const plans = Object.entries(byPlan).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const pTot = plans.reduce((a, [, v]) => a + v, 0);
    const meth = {}; monthSales.forEach((s) => Object.entries(methodNet(s)).forEach(([k, v]) => { meth[k] = (meth[k] || 0) + v; }));
    const t = todayKey();
    const live = store.members.filter((m) => LIVE_STATUS.includes(memberStatus(m, t))).length;
    const expired = store.members.filter((m) => memberStatus(m, t) === 'vencido').length;
    const retention = live + expired ? Math.round((live / (live + expired)) * 100) : 0;
    const avgTicket = ok.length ? ok.reduce((a, s) => a + (s.total || 0), 0) / ok.length : 0;
    const hours = Array(24).fill(0); checkins.forEach((c) => { hours[c.hour ?? new Date(c.date).getHours()]++; });
    const hFrom = Math.max(0, hours.findIndex((v) => v) - 1); const hTo = 24 - Math.max(0, [...hours].reverse().findIndex((v) => v) - 1);
    const top = Object.entries(checkins.reduce((a, c) => { a[c.memberId] = (a[c.memberId] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const prog = store.liveMembers.filter((m) => (m.evalHist || []).length > 1);
    const lost = prog.reduce((a, m) => { const h = m.evalHist; const d = (h[h.length - 1].weight || 0) - (h[0].weight || 0); return d < 0 && !/masa|fuerza|músculo/i.test(m.goal || '') ? a - d : a; }, 0);
    el.querySelector('[data-body]').innerHTML = `
      <div class="kpis">
        <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Ingresos del mes</span><span class="kpi-icon tone-success">${icon('dollar')}</span></div><div class="kpi-value">${usd(inc[5].v)}</div><div class="kpi-sub">${inc[4].v ? `${inc[5].v >= inc[4].v ? '▲' : '▼'} ${num(Math.abs(((inc[5].v - inc[4].v) / inc[4].v) * 100), 0)} % vs. mes anterior` : 'primer mes con datos'}</div></div>
        <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Retención</span><span class="kpi-icon tone-brand">${icon('refresh')}</span></div><div class="kpi-value">${retention} %</div><div class="kpi-sub">${live} activos · ${expired} vencidos</div></div>
        <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Ticket promedio</span><span class="kpi-icon tone-info">${icon('receipt')}</span></div><div class="kpi-value">${usd(avgTicket)}</div><div class="kpi-sub">${ok.length} cobros en 6 meses</div></div>
        <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Kilos perdidos</span><span class="kpi-icon tone-violet">${icon('trend')}</span></div><div class="kpi-value">${num(lost, 1)} kg</div><div class="kpi-sub">entre ${prog.length} alumno(s) evaluados</div></div>
      </div>
      <div class="grid-2">
        <div class="card"><div class="card-title">${icon('chart')} Ingresos por mes</div>${vbars(inc, (v) => usd(v), 'success')}</div>
        <div class="card"><div class="card-title">${icon('userCheck')} Sesiones asistidas por mes</div>${vbars(ses, (v) => v, 'brand')}</div>
      </div>
      <div class="grid-2 mt-lg">
        <div class="card"><div class="card-title">${icon('ticket')} Ingresos por plan o servicio</div><div class="mt">${plans.length ? plans.map(([k, v]) => `<div class="hbar"><span class="ellipsis">${esc(k)}</span><div class="progress"><i style="width:${pTot ? Math.round((v / pTot) * 100) : 0}%"></i></div><b class="num">${usd(v)}</b></div>`).join('') : '<div class="small muted">Sin datos.</div>'}</div></div>
        <div class="card"><div class="card-title">${icon('wallet')} Formas de pago (este mes)</div><div class="mt">${Object.keys(meth).length ? Object.entries(meth).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="hbar"><span>${esc(methodLabel(k))}</span><div class="progress"><i style="width:${Math.round((v / Math.max(1, inc[5].v)) * 100)}%"></i></div><b class="num">${usd(v)}</b></div>`).join('') : '<div class="small muted">Sin cobros este mes.</div>'}</div></div>
      </div>
      <div class="grid-2 mt-lg">
        <div class="card"><div class="card-title">${icon('userPlus')} Alumnos nuevos por mes</div>${vbars(news, (v) => v, 'info')}</div>
        <div class="card"><div class="card-title">${icon('clock')} Horas con más sesiones</div>${hours.some(Boolean) ? `<div class="hours">${hours.slice(hFrom, hTo).map((v, i) => `<div class="hcol" title="${hFrom + i}:00 · ${v}"><b>${v || ''}</b><i style="height:${Math.max(3, (v / Math.max(1, ...hours)) * 100)}%"></i><span>${hFrom + i}</span></div>`).join('')}</div>` : '<div class="small muted">Sin datos.</div>'}</div>
      </div>
      <div class="card mt-lg"><div class="card-title">${icon('trophy')} Alumnos más constantes (6 meses)</div><div class="list mt">${top.length ? top.map(([id, n], i) => `<div class="list-item"><span class="rank">${i + 1}</span><div class="grow"><b>${esc(store.member(id)?.name || 'Alumno')}</b></div><b>${n} sesiones</b></div>`).join('') : '<div class="small muted">Sin datos.</div>'}</div></div>`;
    el.querySelector('[data-csv]').onclick = () => {
      const rows = [['Recibo', 'Fecha', 'Alumno', 'Concepto', 'Forma de pago', 'Total', 'Estado']];
      sales.forEach((s) => rows.push([s.number, s.date, s.memberName, (s.items || []).map((i) => i.name).join(' + '), methodLabel(s.method), s.total, s.status === 'voided' ? 'Anulado' : 'Válido']));
      download(`cobros-${todayKey()}.csv`, '﻿' + toCSV(rows), 'text/csv;charset=utf-8');
    };
    el.querySelector('[data-print]').onclick = () => printDoc('Reporte de los últimos 6 meses', `
      <div class="kpis"><div class="kpi">Ingresos del mes<b>${usd(inc[5].v)}</b></div><div class="kpi">Retención<b>${retention} %</b></div><div class="kpi">Alumnos activos<b>${live}</b></div><div class="kpi">Por cobrar<b>${usd(store.totalDebt)}</b></div></div>
      <h2>Ingresos y sesiones por mes</h2><table><thead><tr><th>Mes</th><th class="r">Ingresos</th><th class="r">Sesiones</th><th class="r">Alumnos nuevos</th></tr></thead><tbody>${months.map((m, i) => `<tr><td>${m.l} ${m.k.slice(0, 4)}</td><td class="r">${usd(inc[i].v)}</td><td class="r">${ses[i].v}</td><td class="r">${news[i].v}</td></tr>`).join('')}</tbody></table>
      <h2>Ingresos por plan o servicio</h2><table><tbody>${plans.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="r">${usd(v)}</td></tr>`).join('')}</tbody></table>`);
  }
}
