/* Sürümlenmiş katalog. Yalnızca var olan, açılabilir kaynaklar önerilir. */
(function () {
  'use strict';
  const entries = [
    {id:'commerce',kind:'design',stage:'available',sector:['retail','general'],title:'commerce_title',description:'commerce_desc',path:'../library/?design=commerce',preset:'commerce'},
    {id:'atelier',kind:'design',stage:'available',sector:['fashion','services','general'],title:'atelier_title',description:'atelier_desc',path:'../library/?design=atelier',preset:'atelier'},
    {id:'table',kind:'design',stage:'available',sector:['food','community','general'],title:'food_title',description:'food_desc',path:'../library/?design=table',preset:'table'},
    {id:'denim-notes',kind:'tool',stage:'experimental',sector:['fashion','retail'],title:'denim_title',description:'denim_desc',path:'../tools/denim/'}
  ];
  function recommend(sector) {
    return entries.map((e,index)=>({e,index,score:e.sector.includes(sector)?3:e.sector.includes('general')?1:0}))
      .filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).map(x=>x.e);
  }
  window.MsCatalog = {entries,recommend};
})();
