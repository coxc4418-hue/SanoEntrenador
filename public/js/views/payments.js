// SanoEntrenador — Cobros: lo cobrado, recibos, deudas y cobro libre de servicios
import { store } from '../store.js';
import { chargeService, voidSale, methodNet } from '../ops.js';
import { esc, usd, num, toast, todayKey, dayKey, addDays, fmtDateTime, emptyState, openModal, methodLabel, parseNum, round2, normalize, debounce, setBusy, waLink, loc } from '../utils.js';
import { icon } from '../icons.js';
import { avatar, hydratePhotos, openMember, pickMember } from '../member.js';
import { printReceipt } from '../shared.js';
import { requirePin } from '../auth.js';

const RANGES = [['hoy', 'Hoy'], ['7', '7 días'], ['mes', 'Este mes'], ['30', '30 días']];

export function mount(el) {
  let range = 'mes'; let q = '';
  el.innerHTML = `
    <div class="view-header"><div><h1 class="view-title">Cobros</h1><p class="view-sub">Planes, abonos y servicios · ${esc(loc().curName)}</p></div>
      <div class="view-actions"><button class="btn btn-secondary" data-free>${icon('receipt')} Cobro libre</button><button class="btn btn-primary" data-sell>${icon('ticket')} Vender plan</button></div></div>
    <div class="kpis" data-tour="pay-kpis" data-k></div>
    <div class="grid-main">
      <div class="card card-flush"><div class="card-head" style="padding:16px 18px 0;flex-wrap:wrap;gap:8px"><div class="card-title">${icon('receipt')} Recibos</div><div class="seg" data-r>${RANGES.map(([k, l]) => `<button data-rg="${k}" class="${k === range ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div style="padding:10px 18px 0"><label class="search">${icon('search')}<input data-q placeholder="Buscar alumno o N° de recibo…"></label></div><div data-list></div></div>
      <div class="stack">
        <div class="card"><div class="card-title">${icon('wallet')} Por forma de pago</div><div data-meth class="mt"></div></div>
        <div class="card"><div class="card-head"><div class="card-title">${icon('alert')} Te deben</div><b data-dtot></b></div><div data-debt></div></div>
      </div>
    </div>`;
  const $ = (s) => el.querySelector(s);
  const from = () => { const t = new Date(); if (range === 'hoy') return todayKey(); if (range === 'mes') return todayKey().slice(0, 8) + '01'; return dayKey(addDays(t, -(Number(range) - 1))); };
  const inRange = () => store.recentSales.filter((s) => (s.dayKey || '') >= from());

  function kpis() {
    const ok = (l) => l.filter((s) => s.status !== 'voided');
    const sum = (l) => ok(l).reduce((a, s) => a + (s.total || 0), 0);
    const t = todayKey(); const month = t.slice(0, 7);
    const today = store.recentSales.filter((s) => s.dayKey === t);
    const week = store.recentSales.filter((s) => s.dayKey >= dayKey(addDays(new Date(), -6)));
    const mon = store.recentSales.filter((s) => (s.dayKey || '').slice(0, 7) === month);
    const plans = ok(mon).filter((s) => s.kind === 'plan' || s.kind === 'abono').length;
    $('[data-k]').innerHTML = `
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Hoy</span><span class="kpi-icon tone-success">${icon('dollar')}</span></div><div class="kpi-value">${usd(sum(today))}</div><div class="kpi-sub">${ok(today).length} cobro(s)</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Últimos 7 días</span><span class="kpi-icon tone-info">${icon('trend')}</span></div><div class="kpi-value">${usd(sum(week))}</div><div class="kpi-sub">${ok(week).length} cobro(s)</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Este mes</span><span class="kpi-icon tone-brand">${icon('chart')}</span></div><div class="kpi-value">${usd(sum(mon))}</div><div class="kpi-sub">${plans} plan(es) y abonos</div></div>
      <div class="card kpi"><div class="kpi-top"><span class="kpi-label">Por cobrar</span><span class="kpi-icon tone-${store.debtors.length ? 'danger' : 'neutral'}">${icon('wallet')}</span></div><div class="kpi-value">${usd(store.totalDebt)}</div><div class="kpi-sub">${store.debtors.length} alumno(s)</div></div>`;
  }
  function list() {
    const tq = normalize(q);
    const l = inRange().filter((s) => !tq || normalize(`${s.memberName} ${s.number}`).includes(tq));
    $('[data-list]').innerHTML = l.length ? `<div class="list" style="padding:8px 10px 12px">${l.map((s) => `<div class="list-item ${s.status === 'voided' ? 'voided' : ''}"><span class="kpi-icon tone-${s.kind === 'servicio' ? 'violet' : s.kind === 'abono' ? 'warning' : 'success'}" style="width:38px;height:38px">${icon(s.kind === 'servicio' ? 'clipboard' : s.kind === 'abono' ? 'dollar' : 'ticket')}</span>
      <div class="grow" style="min-width:0"><b class="ellipsis">${esc(s.memberName || 'Cliente')}</b><div class="t-sub ellipsis">${esc(s.number)} · ${(s.items || []).map((i) => esc(i.name)).join(', ')}</div><div class="t-sub">${fmtDateTime(s.date)} · ${esc(methodLabel(s.method))}${s.status === 'voided' ? ' · <b class="text-danger">ANULADO</b>' : ''}</div></div>
      <div class="r"><b class="num">${usd(s.total)}</b><div class="row" style="gap:2px;justify-content:flex-end"><button class="btn btn-ghost btn-icon btn-sm" data-pr="${s.id}" aria-label="Imprimir">${icon('print')}</button><button class="btn btn-ghost btn-icon btn-sm" data-wr="${s.id}" aria-label="Enviar recibo">${icon('whatsapp')}</button>${s.status !== 'voided' ? `<button class="btn btn-ghost btn-icon btn-sm" data-vo="${s.id}" aria-label="Anular">${icon('trash')}</button>` : ''}</div></div></div>`).join('')}</div>`
      : `<div style="padding:16px">${emptyState('receipt', 'Sin cobros en este período')}</div>`;
    const get = (id) => l.find((s) => s.id === id);
    el.querySelectorAll('[data-pr]').forEach((b) => b.onclick = () => printReceipt(get(b.dataset.pr)));
    el.querySelectorAll('[data-wr]').forEach((b) => b.onclick = () => {
      const s = get(b.dataset.wr); const m = store.member(s.memberId);
      const text = `*${store.businessName}*\nRecibo ${s.number} · ${fmtDateTime(s.date)}\n\n${(s.items || []).map((i) => `• ${i.name}: ${usd(i.total ?? i.price)}`).join('\n')}\n\n*Total: ${usd(s.total)}* (${methodLabel(s.method)})${m && (Number(m.balance) || 0) > 0.009 ? `\nSaldo pendiente: ${usd(m.balance)}` : ''}\n\n¡Gracias! 💪`;
      window.open(m?.phone || s.memberPhone ? waLink(m?.phone || s.memberPhone, text) : 'https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener');
    });
    el.querySelectorAll('[data-vo]').forEach((b) => b.onclick = () => voidModal(get(b.dataset.vo)));
    // Formas de pago del período
    const net = {}; let tot = 0;
    inRange().filter((s) => s.status !== 'voided').forEach((s) => { Object.entries(methodNet(s)).forEach(([k, v]) => { net[k] = (net[k] || 0) + v; tot += v; }); });
    const rows = Object.entries(net).sort((a, b) => b[1] - a[1]);
    $('[data-meth]').innerHTML = rows.length ? rows.map(([k, v]) => `<div class="hbar"><span>${esc(methodLabel(k))}</span><div class="progress"><i style="width:${tot ? Math.round((v / tot) * 100) : 0}%"></i></div><b class="num">${usd(v)}</b></div>`).join('') : '<div class="small muted">Sin cobros.</div>';
  }
  function debts() {
    const d = store.debtors;
    $('[data-dtot]').textContent = usd(store.totalDebt);
    $('[data-debt]').innerHTML = d.length ? `<div class="list">${d.map((m) => `<div class="list-item">${avatar(m)}<div class="grow" style="min-width:0"><button class="linkish" data-m="${m.id}"><b class="ellipsis">${esc(m.name)}</b></button><div class="t-sub">${esc(m.membership?.planName || '')}</div></div><b class="text-danger num">${usd(m.balance)}</b><button class="btn btn-secondary btn-sm" data-pay="${m.id}">Cobrar</button></div>`).join('')}</div>` : emptyState('checkCircle', 'Nadie te debe', '¡Excelente!');
    el.querySelectorAll('[data-debt] [data-m]').forEach((b) => b.onclick = () => openMember(b.dataset.m, { tab: 'plan' }));
    el.querySelectorAll('[data-pay]').forEach((b) => b.onclick = async () => { const { payDebtModal } = await import('../membership.js'); payDebtModal(store.member(b.dataset.pay)); });
    hydratePhotos($('[data-debt]'));
  }
  async function voidModal(s) {
    if (!(await requirePin('Anular un recibo'))) return;
    const m = openModal({
      title: `Anular ${esc(s.number)}`, sub: `${esc(s.memberName)} · ${usd(s.total)}`, size: 'sm',
      body: `<div class="stack"><div class="box small box-warn">${icon('alert')} ${s.kind === 'plan' ? 'Se anula también el plan vendido y el alumno vuelve a su plan anterior.' : s.kind === 'abono' ? 'El monto vuelve a quedar como deuda del alumno.' : 'El cobro deja de contar en los reportes.'}</div><div class="field"><label>Motivo</label><input class="input" data-r placeholder="Ej.: error al registrar"></div></div>`,
      footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-danger" data-ok>${icon('trash')} Anular</button>`
    });
    m.el.querySelector('[data-ok]').onclick = async (e) => {
      setBusy(e.currentTarget, true);
      try { await voidSale(s, m.el.querySelector('[data-r]').value.trim()); m.close(); toast('Recibo anulado', 'warning'); } catch (ex) { toast(ex.message, 'danger'); setBusy(e.currentTarget, false); }
    };
  }
  async function freeCharge() {
    const services = store.settings.services || [];
    let member = null; const lines = [];
    const m = openModal({
      title: 'Cobro libre', sub: 'Evaluación, plan de alimentación, recargo a domicilio…', size: 'md',
      body: `<div class="stack"><div class="field"><label>Alumno (opcional)</label><button type="button" class="btn btn-secondary btn-block" data-pm>${icon('user')} Elegir alumno</button></div>
        <div class="field"><label>Servicios</label><div class="chips chips-wrap">${services.map((s, i) => `<button type="button" class="chip" data-sv="${i}">${esc(s.name)} · ${usd(s.price)}</button>`).join('')}</div></div>
        <div class="form-grid"><div class="field"><label>Otro concepto</label><input class="input" data-cn placeholder="Ej.: Sesión de estiramiento"></div><div class="field"><label>Monto</label><input class="input" data-cp inputmode="decimal" placeholder="0"></div></div>
        <button type="button" class="btn btn-ghost btn-sm" data-addl>${icon('plus')} Agregar concepto</button>
        <div class="summary-box" data-sum></div><div class="error-msg" data-err></div></div>`,
      footer: `<button class="btn btn-secondary" data-close>Cancelar</button><button class="btn btn-primary" data-ok>${icon('check')} Cobrar</button>`
    });
    const draw = () => {
      const tot = round2(lines.reduce((a, l) => a + l.price, 0));
      m.el.querySelector('[data-sum]').innerHTML = lines.length ? lines.map((l, i) => `<div class="summary-row"><span>${esc(l.name)} <button class="linkish small" data-rl="${i}">quitar</button></span><b>${usd(l.price)}</b></div>`).join('') + `<div class="summary-row sum-total"><span>Total</span><b>${usd(tot)}</b></div>` : '<div class="small muted">Elige un servicio o escribe un concepto.</div>';
      m.el.querySelectorAll('[data-rl]').forEach((b) => b.onclick = () => { lines.splice(Number(b.dataset.rl), 1); draw(); });
    };
    m.el.querySelector('[data-pm]').onclick = async () => { const p = await pickMember({ allowNew: true }); if (p) { member = p; m.el.querySelector('[data-pm]').textContent = p.name; } };
    m.el.querySelectorAll('[data-sv]').forEach((b) => b.onclick = () => { const s = services[Number(b.dataset.sv)]; lines.push({ name: s.name, price: Number(s.price) || 0, qty: 1, kind: 'servicio' }); draw(); });
    m.el.querySelector('[data-addl]').onclick = () => { const n = m.el.querySelector('[data-cn]').value.trim(); const p = parseNum(m.el.querySelector('[data-cp]').value); if (!n || !(p > 0)) { m.el.querySelector('[data-err]').textContent = 'Escribe el concepto y el monto.'; return; } lines.push({ name: n, price: p, qty: 1, kind: 'servicio' }); m.el.querySelector('[data-cn]').value = ''; m.el.querySelector('[data-cp]').value = ''; m.el.querySelector('[data-err]').textContent = ''; draw(); };
    m.el.querySelector('[data-ok]').onclick = async () => {
      const n = m.el.querySelector('[data-cn]').value.trim(); const p = parseNum(m.el.querySelector('[data-cp]').value);
      if (n && p > 0) lines.push({ name: n, price: p, qty: 1, kind: 'servicio' });
      if (!lines.length) { m.el.querySelector('[data-err]').textContent = 'Agrega al menos un concepto.'; return; }
      const total = round2(lines.reduce((a, l) => a + l.price, 0));
      m.close();
      const { openPay, showPaid } = await import('../pay.js');
      await openPay({ title: 'Cobro libre', sub: esc(member?.name || 'Cliente'), amount: total, printLabel: 'Imprimir recibo',
        onConfirm: async (res) => { const out = await chargeService({ lines, member, payments: res.payments }); if (res.print) printReceipt(out.sale); showPaid(out.sale, { title: 'Cobro registrado', onPrint: () => printReceipt(out.sale) }); return out; } });
    };
    draw();
  }
  el.querySelectorAll('[data-rg]').forEach((b) => b.onclick = () => { range = b.dataset.rg; el.querySelectorAll('[data-rg]').forEach((x) => x.classList.toggle('on', x === b)); list(); });
  $('[data-q]').oninput = debounce((e) => { q = e.target.value; list(); }, 120);
  $('[data-sell]').onclick = async () => { const { sellModal } = await import('../membership.js'); sellModal(); };
  $('[data-free]').onclick = freeCharge;
  kpis(); list(); debts();
  const off = store.on('*', (evt) => { if (evt === 'sales' || evt === 'rate') { kpis(); list(); } if (evt === 'members') { kpis(); debts(); } });
  return () => off();
}
export { num };
