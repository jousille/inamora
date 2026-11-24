// ── month.js — экран итогов месяца ───────────────────────────

const MonthScreen = (() => {

  const MONTH_QUESTIONS = [
    { key: 'discovery',  q: 'Главное открытие месяца об энергии' },
    { key: 'bestTime',   q: 'В какое время дня было больше всего энергии?' },
    { key: 'recovery',   q: 'Что лучше всего восстанавливает тебя?' },
    { key: 'change',     q: 'Что изменю в следующем месяце?' },
    { key: 'gratitude',  q: 'За что я благодарна себе в этом месяце?' },
  ];

  const SPHERES = DB.SPHERES;

  // Цвета секторов — тёплая палитра в тоне приложения
  const SPHERE_COLORS = [
    '#C97B7B', '#D4A56A', '#B8C46A', '#6AB8A5',
    '#6A8BB8', '#9B6AB8', '#B86A9B',
  ];

  function collect(){
    const s=DB.settings(), entries=[], recorded=new Set(), spheres=new Map(SPHERES.map(x=>[x.id,{...x,dates:new Set(),scores:[]}]));
    const habits=s.habits?DB.getHabits():[];
    for(let w=1;w<=4;w++)for(let d=1;d<=7;d++){
      const date=DB.dateForDay(w,d);if(!date||date>DB.localDate())continue;
      const comp=DB.getCompletionsForDate(date);
      const rows=(s.tasks?DB.getTasks(w,d).map(t=>({...t,kind:'task'})):[]).concat(habits.filter(h=>comp[h.id]).map(h=>({...h,kind:'habit',score:h.energy})));
      for(const t of rows){const name=String(t.name||'').trim();if(!name)continue;recorded.add(date);const score=s.energy&&typeof t.score==='number'&&Number.isFinite(t.score)?t.score:null;entries.push({name,kind:t.kind,date,score,sphereId:t.sphereId});const row=spheres.get(t.sphereId);if(row){row.dates.add(date);if(score!==null)row.scores.push(score);}}
    }
    return {entries,recorded,spheres:[...spheres.values()]};
  }
  function observations(p,data){
    const s=DB.settings(), out=[], groups=new Map();
    for(const e of data.entries){if(e.score===null)continue;const key=e.kind+':'+e.name.toLocaleLowerCase('ru');if(!groups.has(key))groups.set(key,{name:e.name,rows:[]});groups.get(key).rows.push(e);}
    const g=[...groups.values()].filter(x=>new Set(x.rows.map(e=>e.date)).size>=3);
    for(const sign of [1,-1]){
      const candidates=g.map(x=>({...x,n:x.rows.filter(e=>e.score*sign>0).length,sum:x.rows.reduce((a,e)=>a+e.score,0)})).filter(x=>x.n/x.rows.length>=.75&&x.sum*sign>0).sort((a,b)=>sign*(b.sum-a.sum));
      if(candidates.length){const x=candidates[0];out.push([sign>0?'Что наполняет':'Что истощает',x.name+': '+x.n+' из '+x.rows.length+' оценок '+(sign>0?'положительные':'отрицательные')+'.','Баланс '+fmt(x.sum)+'; оценки минимум в 3 разных дня.']);}
    }
    if(s.energy){const a=period(1,2),b=period(3,4);if(a.dates.length===14&&b.dates.length===14&&a.days.length>=7&&b.days.length>=7){const x=a.total/a.days.length,y=b.total/b.days.length;if(Math.abs(y-x)>=1)out.push(['Динамика энергии','Средний баланс оценённых дней '+(y>x?'вырос':'снизился')+' с '+fmt(Math.round(x*10)/10)+' до '+fmt(Math.round(y*10)/10)+'.','Первая и вторая половины цикла: '+a.days.length+' и '+b.days.length+' оценённых дней.']);}}
    if(s.habits&&p.dates.length>=14){const rows=p.rows.filter(h=>h.total>=4);const best=rows.filter(h=>h.pct>=80).sort((a,b)=>b.pct-a.pct)[0],low=rows.filter(h=>h.pct<=40).sort((a,b)=>a.pct-b.pct)[0];if(best)out.push(['Регулярность привычек',best.name+': выполнено '+best.done+' из '+best.total+' запланированных выполнений.','Регулярность '+best.pct+'%.']);if(low)out.push(['График привычек',low.name+': выполнено '+low.done+' из '+low.total+' запланированных выполнений.','Можно пересмотреть удобство графика; регулярность '+low.pct+'%.']);}
    if(s.spheres){const dates=new Set(data.spheres.flatMap(x=>[...x.dates]));if(dates.size>=7){const rows=data.spheres.filter(x=>x.dates.size).sort((a,b)=>b.dates.size-a.dates.size);const top=rows.filter(x=>x.dates.size===rows[0].dates.size);out.push(['Моё внимание',top.map(x=>x.name).join(', ')+' − чаще всего в записях: '+top[0].dates.size+' дн.','Учитываются уникальные дни, а не количество записей.']);}}
    return out.slice(0,5);
  }
  function sphereList(data){
    const s=DB.settings();
    return '<div class="month-spheres '+(s.energy?'':'no-energy')+'"><div class="month-sphere-row month-sphere-head"><span>Сфера</span><span>Дни</span>'+(s.energy?'<span>Энергия</span>':'')+'</div>'+data.spheres.map(x=>{const n=x.scores.length?x.scores.reduce((a,b)=>a+b,0):null;return '<div class="month-sphere-row"><span class="month-sphere-name"><span>'+x.emoji+'</span><span>'+escHtml(x.name)+'</span></span><span>'+x.dates.size+'</span>'+(s.energy?'<span class="'+(n>0?'review-pos':n<0?'review-neg':'')+'">'+fmt(n)+'</span>':'')+'</div>';}).join('')+'</div><div class="sc-sub">Дни присутствия в записях, не оценка качества жизни.</div>';
  }
  function period(from=1,to=4){
    const days=[],dates=[];let tasks=0,marks=0,positive=0,negative=0;
    const settings=DB.settings();const habits=settings.habits?DB.getHabits():[];
    for(let w=from;w<=to;w++)for(let d=1;d<=7;d++){
      const date=DB.dateForDay(w,d);if(!date||date>DB.localDate())continue;
      dates.push(date);const entries=(settings.tasks?DB.getTasks(w,d):[]).filter(t=>String(t.name||'').trim());tasks+=entries.length;
      const comp=DB.getCompletionsForDate(date),done=habits.filter(h=>comp[h.id]);marks+=done.length;
      const scores=entries.filter(t=>t.score!==null&&t.score!==undefined).map(t=>Number(t.score)||0).concat(done.map(h=>Number(h.energy)||0));
      if(scores.length){const total=scores.reduce((a,b)=>a+b,0);days.push({w,d,date,total});for(const n of scores){positive+=Math.max(0,n);negative+=Math.max(0,-n);}}
    }
    const rows=habits.map(h=>({name:h.name,...DB.habitProgress(h,dates)})).filter(h=>h.total);
    const done=rows.reduce((a,h)=>a+h.done,0),target=rows.reduce((a,h)=>a+h.total,0);
    return {days,dates,tasks,marks,positive,negative,total:positive-negative,rows,done,target,pct:target?Math.round(done/target*100):null};
  }
  function fmt(n){return n===null?'−':n>0?'+'+n:n<0?'−'+Math.abs(n):'0';}
  function balance(p){return '<div class="review-card review-center"><div class="sc-label">Баланс энергии</div><div class="review-big '+(p.total<0?'review-neg':'review-pos')+'">'+fmt(p.days.length?p.total:null)+'</div><div class="review-pair"><span class="review-pos">Получено '+fmt(p.positive)+'</span><span class="review-neg">Потрачено '+fmt(-p.negative)+'</span></div><div class="review-track"><i style="width:'+(100*p.positive/Math.max(1,p.positive+p.negative))+'%"></i><b style="width:'+(100*p.negative/Math.max(1,p.positive+p.negative))+'%"></b></div><div class="sc-sub">Дней с оценками: '+p.days.length+' из '+p.dates.length+'</div></div>';}
  function chart(values,labels){
    const max=Math.max(1,...values.filter(n=>typeof n==='number').map(Math.abs)),step=280/values.length;
    return '<div class="review-card"><svg viewBox="0 0 320 150" width="100%" role="img" aria-label="Динамика энергии"><line x1="12" y1="70" x2="308" y2="70" stroke="#D4B8B8"/>'+values.map((n,i)=>{const x=20+step*(i+.5),h=n==null?0:Math.abs(n)/max*48;return (n==null||n===0?'': '<rect x="'+(x-10)+'" y="'+(n>=0?70-h:70)+'" width="20" height="'+Math.max(1,h)+'" rx="3" fill="'+(n>=0?'#8DA787':'#C99489')+'"/>')+'<text x="'+x+'" y="'+(n==null?65:n>=0?65-h:82+h)+'" text-anchor="middle" font-size="10" fill="#6B4E4E">'+ (n===undefined?'':fmt(n))+'</text><text x="'+x+'" y="145" text-anchor="middle" font-size="10" fill="#6B4E4E">'+labels[i]+'</text>';}).join('')+'</svg>'+(values.includes(null)?'<div class="sc-sub">'+(values.length===7?'Дни':'Недели')+' без оценок обозначены прочерком</div>':'')+'</div>';
  }
  function habitsReview(p){return '<div class="review-card"><div class="review-big">'+(p.pct===null?'−':p.pct+'%')+'</div><div class="sc-sub">'+p.done+' из '+p.target+' запланированных выполнений</div>'+p.rows.map(h=>'<div class="review-habit"><span>'+escHtml(h.name)+'</span><span>'+h.done+'/'+h.total+'</span></div><div class="ssr-track"><div class="ssr-fill" style="width:'+h.pct+'%;background:#B58E8E"></div></div>').join('')+'</div>';}
  function render() {
    const el = document.getElementById('screen-month');

    const p=period(), data=collect(), insights=observations(p,data), settings=DB.settings();
    const weekScores = [1,2,3,4].map(w => DB.getWeekScore(w));
    const monthScore = weekScores.reduce((s, v) => s + v, 0);
    const totalTasks = (() => { let n = 0; for (let w=1;w<=4;w++) for (let d=1;d<=7;d++) n+=DB.getTasks(w,d).length; return n; })();

    const bestWeekIdx  = weekScores.indexOf(Math.max(...weekScores));
    const worstWeekIdx = weekScores.indexOf(Math.min(...weekScores));
    const maxAbs = Math.max(1, ...weekScores.map(Math.abs));

    const vampires   = DB.getActiveSources(1,4,'min');
    const donors     = DB.getActiveSources(1,4,'max');
    const refl       = DB.getReflection('month');
    const meta       = DB.getMeta();
    const sphereStats = DB.getHabitsSphereStats();

    const scoreDisp = monthScore > 0 ? `+${monthScore}` : `${monthScore}`;

    const monthName = (() => {
      const d = meta.startDate ? DB.parseDate(meta.startDate) : new Date();
      return d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    })();

    el.innerHTML = `
      <div class="page-header">
        <div class="eyebrow">Итоги</div>
        <div class="title">${capitalize(monthName)}</div>
        <div class="subtitle">${data.recorded.size} дней с записями · 4 недели</div>
      </div>

      <div class="page-content">
        <div class="section-label">Главное за месяц</div>
        <div class="stat-grid">
        ${settings.energy?'<div class="stat-card"><div class="sc-label">Баланс энергии</div><div class="sc-value '+(p.days.length&&p.total>0?'review-pos':p.days.length&&p.total<0?'review-neg':'')+'">'+fmt(p.days.length?p.total:null)+'</div></div>':''}
        ${settings.habits?'<div class="stat-card"><div class="sc-label">Регулярность привычек</div><div class="sc-value">'+(p.pct===null?'−':p.pct+'%')+'</div></div>':''}
        </div>
        <div class="sc-sub">Записи в ${data.recorded.size} из ${p.dates.length} дней</div>
        <div class="section-label">Что я узнала о себе</div>
        <div class="review-card">${insights.length?insights.map(([title,body,proof])=>'<div class="month-insight"><div class="sc-label">'+escHtml(title)+'</div><p>'+escHtml(body)+'</p><details><summary>На основании чего?</summary><div class="sc-sub">'+escHtml(proof)+'</div></details></div>').join(''):'<p>Пока недостаточно записей для устойчивых наблюдений.</p>'}</div>
        <div class="section-label">Подробнее о моём месяце</div>
        ${settings.energy?'<details class="review-card"><summary>Энергия</summary>'+balance(p)+chart([1,2,3,4].map(w=>{const x=period(w,w);return !x.dates.length?undefined:x.days.length?x.total:null;}),['Нед 1','Нед 2','Нед 3','Нед 4'])+(donors.length?renderVD(donors,'pos','Что наполняло'):'')+(vampires.length?renderVD(vampires,'neg','Что истощало'):'')+'</details>':''}
        ${settings.spheres?'<details class="review-card"><summary>Сферы жизни</summary>'+sphereList(data)+'</details>':''}
        ${settings.habits?'<details class="review-card"><summary>Привычки</summary>'+habitsReview(p)+'</details>':''}
        <div ${DB.settings().reflection?'':'hidden'}>
        <div class="section-label">Завершая месяц</div>
        ${[{key:'insight_v2',q:'Что я поняла о себе?'},{key:'more_less_v2',q:'Чего хочется больше, а чего меньше?'},{key:'focus_v2',q:'Мой фокус на следующий месяц'}].map(({key,q})=>'<div class="reflection-card"><div class="ref-q">'+q+'</div><textarea class="ref-input" data-key="'+key+'" placeholder="Можно оставить пустым">'+escHtml(refl[key]||'')+'</textarea></div>').join('')}
        ${MONTH_QUESTIONS.some(q=>refl[q.key])?'<details class="review-card"><summary>Предыдущие ответы</summary>'+MONTH_QUESTIONS.filter(q=>refl[q.key]).map(q=>'<div class="ref-q">'+q.q+'</div><textarea class="ref-input" data-key="'+q.key+'">'+escHtml(refl[q.key])+'</textarea>').join('')+'</details>':''}
        </div>

      </div>
    `;


    // Автосохранение рефлексии
    document.querySelectorAll('#screen-month .ref-input[data-key]').forEach(ta => {
      ta.addEventListener('input', () => {
        const r = DB.getReflection('month');
        r[ta.dataset.key] = ta.value;
        DB.saveReflection(r, 'month');
      });
    });
  }

  function renderVD(items, type, title) {
    if (!items.length) {
      return `<div class="empty-state" style="padding:16px">Заполните дни − данные появятся автоматически</div>`;
    }
    return `
      <div class="vd-card">
        <div class="vd-header">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${type === 'neg' ? 'var(--accent)' : 'var(--pos-5-tx)'}" stroke-width="1.5" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          <span>${title}</span>
        </div>
        ${items.map((item, i) => `
          <div class="vd-row">
            <span class="vd-num">${i + 1}</span>
            <span class="vd-name">${escHtml(item.name)}</span>
            <span class="vd-chip ${item.score === 10 ? 'pos10' : type}">${item.score > 0 ? '+' : ''}${item.score}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function renderSphereEnergy(rows, detailed=false) {
    const fmt=n=>n>0?'+'+n:n<0?'−'+Math.abs(n):'0';
    const max=Math.max(1,...rows.map(r=>Math.abs(r.total)));
    return '<div class="section-label">Энергия по сферам</div>'+(!rows.length?'<div class="empty-state">Данных пока нет</div>':rows.map(r=>{
      const balance='<span class="sphere-energy-value '+(r.total<0?'neg':'pos')+'">'+fmt(r.total)+'</span>';
      const title='<span>'+r.emoji+' '+r.name+'</span>'+balance;
      if(!detailed)return '<div class="sphere-energy-card"><div class="sphere-energy-head">'+title+'</div><div class="sphere-energy-track"><div class="sphere-energy-bar '+(r.total<0?'neg':'pos')+'" style="width:'+Math.abs(r.total)/max*100+'%"></div></div></div>';
      return '<details class="sphere-energy-card"><summary class="sphere-energy-head">'+title+'</summary><div class="sphere-energy-meta">Получено +'+r.positive+' · Потрачено −'+r.negative+'</div><div class="sphere-energy-items">'+r.items.map(i=>'<div class="sphere-energy-head"><span>'+escHtml(i.name)+' <small>'+ (i.kind==='habit'?'Привычка':'Запись')+' · '+i.count+'</small></span><span>'+fmt(i.score)+'</span></div>').join('')+'</div></details>';
    }).join(''));
  }
  return { render, renderSphereEnergy, period, balance, chart, habitsReview, fmt };

})();
