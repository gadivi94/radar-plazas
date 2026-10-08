/* Ficha de una plaza: resumen y preguntas con IA. */
(function(){
  var box=document.getElementById("ia");if(!box)return;
  var out=document.getElementById("iaOut"),nota=document.getElementById("iaNota"),ruta=box.dataset.ruta;
  var id=ruta.replace("/",":");try{id=decodeURIComponent(ruta.split("/")[0])+":"+decodeURIComponent(ruta.split("/").slice(1).join("/"))}catch(e){}
  function pintar(t){out.hidden=false;out.textContent=t}
  document.getElementById("iaResumen").addEventListener("click",async function(){
    var b=this;b.disabled=true;b.textContent="Leyendo las bases…";nota.textContent="";
    try{var r=await fetch("/api/ia/resumen/"+ruta);var j=await r.json();if(!r.ok)throw new Error(j.error||"Error");pintar(j.resumen);b.hidden=true}
    catch(e){nota.textContent=e.message;b.disabled=false;b.textContent="✨ Resumir con IA"}
  });
  document.getElementById("iaForm").addEventListener("submit",async function(ev){
    ev.preventDefault();var q=document.getElementById("iaQ").value.trim();if(!q)return;
    var ses="";try{ses=localStorage.getItem("rp_ses")||""}catch(e){}
    if(!ses){nota.innerHTML='Para preguntar, <a href="/?entrar=1">entra gratis con tu correo</a>.';return}
    nota.textContent="Pensando…";
    try{var r=await fetch("/api/ia/pregunta",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+ses},body:JSON.stringify({id:id,pregunta:q})});
      var j=await r.json();if(!r.ok)throw new Error(j.error||"Error");pintar("❓ "+q+"\n\n"+j.respuesta);nota.textContent="Respuesta orientativa generada con IA a partir de la convocatoria."}
    catch(e){nota.textContent=e.message}
  });
})();
