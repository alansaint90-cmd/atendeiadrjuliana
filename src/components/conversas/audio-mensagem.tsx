"use client";
import {useState} from 'react';

export function AudioMensagem({id,recebida}:{id:string;recebida:boolean}) {
 const [erro,setErro]=useState(false),[tentativa,setTentativa]=useState(0);
 return <div className="conversas-audio">
  {erro?<><p role="status">Não foi possível reproduzir este áudio. O arquivo pode estar indisponível ou não ser compatível com o navegador.</p><button type="button" onClick={()=>{setTentativa(v=>v+1);setErro(false);}}>Tentar ouvir novamente</button></>
   :<audio key={tentativa} controls preload="none" aria-label={recebida?'Ouvir áudio recebido':'Ouvir áudio enviado'} src={`/api/conversas/mensagens/${encodeURIComponent(id)}/audio`} onError={()=>setErro(true)}>Seu navegador não suporta reprodução de áudio.</audio>}
 </div>;
}
