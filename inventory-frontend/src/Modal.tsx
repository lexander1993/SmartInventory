import {useEffect,useId,useRef,type ReactNode} from 'react';

export default function Modal({title,onClose,busy=false,error,children}:{title:string;onClose:()=>void;busy?:boolean;error?:string;children:ReactNode}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 useEffect(()=>{
  const element=dialog.current!;const previous=document.activeElement as HTMLElement|null;
  element.showModal();const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  return()=>{element.close();document.body.style.overflow=overflow;previous?.focus();};
 },[]);
 return <dialog ref={dialog} className="modal" aria-labelledby={titleId} aria-busy={busy} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===dialog.current){const rect=dialog.current.getBoundingClientRect();if(!busy && (e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom))onClose();}}}>
  <div className="modal-heading"><h2 id={titleId}>{title}</h2><button type="button" className="modal-close" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></div>
  {error&&<div role="alert" className="error">{error}</div>}
  {children}
 </dialog>;
}
