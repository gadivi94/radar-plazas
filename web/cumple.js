/* ¿Puedo presentarme? Compara el perfil (guardado en este dispositivo y, con cuenta, en el servidor) con los requisitos detectados. */
(function(){
  var NIVELES=["Sin titulación","ESO / Graduado escolar","Bachillerato o FP de grado medio","FP de grado superior","Grado universitario"];
  
  function tiene(carnes,c){carnes=carnes||[];if(carnes.indexOf(c)>=0)return true;if((c==="A1"||c==="A2")&&carnes.indexOf("A")>=0)return true;if(c==="A1"&&carnes.indexOf("A2")>=0)return true;if(c==="C1"&&carnes.indexOf("C")>=0)return true;return false}
  const NIV_IDIOMA=["A1","A2","B1","B2","C1","C2"];
  function idioma(p,k){const i=(p.idiomas||{});return i[k]||(k==="catalan"?p.catalan:"")||""}
  function cumple(o,p){
    if(!p||p.nivel==null)return null;
    var r=o.requisitos||{},faltan=[],dudas=[];
    if(o.nivel!=null){if(p.nivel<o.nivel)faltan.push("Titulación: piden "+NIVELES[o.nivel])}else dudas.push("titulación");
    if(p.edad){if(r.edadMin&&p.edad<r.edadMin)faltan.push("Edad mínima: "+r.edadMin);if(r.edadMax&&p.edad>r.edadMax)faltan.push("Edad máxima: "+r.edadMax)}
    (r.carne||[]).forEach(function(c){if(!tiene(p.carne,c))faltan.push("Carné "+c)});
    if(r.catalan){var i=NIV_IDIOMA.indexOf(r.catalan),j=Math.max(NIV_IDIOMA.indexOf(idioma(p,"catalan")),NIV_IDIOMA.indexOf(idioma(p,"valenciano")));if(j<i)faltan.push("Catalán "+r.catalan)}
    if(r.otroIdioma){var k={Euskera:"euskera",Gallego:"gallego",Valenciano:"valenciano"}[r.otroIdioma];
      if(k&&!idioma(p,k)&&!(k==="valenciano"&&idioma(p,"catalan")))faltan.push(r.otroIdioma)}
    if(r.nacionalidad==="es"&&p.nacionalidad&&p.nacionalidad!=="es")faltan.push("Nacionalidad española");
    if(r.nacionalidad==="ue"&&p.nacionalidad==="otra")faltan.push("Nacionalidad española o de la UE");
    return {estado:faltan.length?"no":dudas.length?"?":"si",faltan:faltan,dudas:dudas};
  }
  function perfil(){try{return JSON.parse(localStorage.getItem("rp_perfil")||"null")}catch(e){return null}}
  window.RadarCumple={cumple:cumple,perfil:perfil,NIVELES:NIVELES};
  // En la ficha de una plaza
  var box=document.getElementById("cumple");
  if(box&&box.dataset.oferta){
    var o=JSON.parse(box.dataset.oferta),p=perfil(),c=cumple(o,p);
    if(c){box.className="cumple "+c.estado;
      box.innerHTML=c.estado==="si"?"<b>✓ Cumples los requisitos que hemos detectado.</b> Revisa igualmente las bases.":
        c.estado==="no"?"<b>✗ Según tu perfil te falta:</b> "+c.faltan.join(" · ")+". <a href='/#perfil'>Editar perfil</a>":
        "<b>Parece que cumples</b>, pero no hemos podido leer la "+c.dudas.join(" y ")+". Consúltala en las bases.";}
  }
})();
