/** Coalesce change bursts, retaining work while a form or network blocks refresh.
 * @param {{refresh:()=>void, canRefresh:()=>boolean, schedule?:(fn:()=>void,ms:number)=>unknown, cancel?:(handle:unknown)=>void, delay?:number}} options
 */
export function createRefreshScheduler({refresh,canRefresh,schedule=(fn,ms)=>setTimeout(fn,ms),cancel=handle=>clearTimeout(/** @type {ReturnType<typeof setTimeout>} */(handle)),delay=300}) {
  let wanted=false,disposed=false;
  /** @type {unknown} */ let timer=null;
  const flush=()=>{
    if(disposed||!wanted||timer!==null)return;
    timer=schedule(()=>{timer=null;if(disposed||!wanted||!canRefresh())return;wanted=false;refresh();},delay);
  };
  return {request(){if(!disposed){wanted=true;flush();}},flush,dispose(){disposed=true;wanted=false;if(timer!==null)cancel(timer);timer=null;}};
}
