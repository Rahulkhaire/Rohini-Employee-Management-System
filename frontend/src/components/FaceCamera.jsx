import { useEffect, useRef, useState } from "react";

export default function FaceCamera({ onCapture, label = "Capture face", disabled = false }) {
  const videoRef=useRef(null), streamRef=useRef(null);
  const [error,setError]=useState(""); const [ready,setReady]=useState(false);
  useEffect(()=>{ let active=true;
    navigator.mediaDevices?.getUserMedia({video:{facingMode:"user",width:{ideal:640},height:{ideal:480}},audio:false})
      .then(s=>{ if(!active){s.getTracks().forEach(t=>t.stop());return;} streamRef.current=s; if(videoRef.current) videoRef.current.srcObject=s; setReady(true); })
      .catch(()=>setError("Camera access was blocked. Allow camera access in your browser and reload."));
    return ()=>{active=false;streamRef.current?.getTracks().forEach(t=>t.stop());};
  },[]);
  const capture=()=>{const v=videoRef.current;if(!v||!v.videoWidth)return setError("Camera is not ready yet.");const c=document.createElement("canvas");c.width=v.videoWidth;c.height=v.videoHeight;c.getContext("2d").drawImage(v,0,0);onCapture(c.toDataURL("image/jpeg",0.88));};
  return <div className="face-camera"><video ref={videoRef} autoPlay playsInline muted /><div className="muted">Keep one face centred in the frame with good lighting.</div>{error&&<div className="alert error">{error}</div>}<button type="button" className="btn primary" disabled={!ready||disabled} onClick={capture}>{label}</button></div>;
}
