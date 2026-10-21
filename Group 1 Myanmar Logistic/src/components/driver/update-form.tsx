"use client";
import {T,useLanguage} from "@/components/i18n/language-provider";
import {Input,Textarea} from "@/components/i18n/fields";

import { useActionState,useEffect,useRef,useState } from "react";
import { useDraftSnapshot } from "@/lib/tracking/use-draft-snapshot";
import { submitDriverUpdate,type DriverState } from "@/app/(authenticated)/driver/actions";
import { SHIPMENT_STATUSES,SHIPMENT_STATUS_LABELS,type ShipmentStatus } from "@/types/domain";
import { addToQueue } from "@/lib/offline/queue";

export function DriverUpdateForm(props:{shipment:string;revision:string;status:ShipmentStatus;requestId:string;occurredAt:string;userId:string;shipmentNumber:string}) {
  const {locale,t}=useLanguage();
  const {value:{shipment,revision,status,requestId,occurredAt},capture}=useDraftSnapshot(props);
  const [state,action,pending]=useActionState<DriverState,FormData>(submitDriverUpdate,{});
  const [latitude,setLatitude]=useState(""),[longitude,setLongitude]=useState("");
  const [locating,setLocating]=useState(false);
  const [locationMessage,setLocationMessage]=useState("No new location selected. Your last saved location will be kept.");
  const [queuedMessage,setQueuedMessage]=useState("");
  const locationRequest=useRef(0);
  useEffect(()=>()=>{locationRequest.current+=1;},[]);
  function selectLocation(lat:string,lng:string,message:string) {
    locationRequest.current+=1;setLocating(false);setLatitude(lat);setLongitude(lng);setLocationMessage(message);
  }
  function useMyLocation() {
    if(!window.isSecureContext) {setLocationMessage("Device location needs HTTPS or localhost. Open the secure app link, or choose a demo location below.");return;}
    if(!navigator.geolocation) {setLocationMessage("This browser cannot provide your location. Choose a demo location or enter coordinates under Advanced.");return;}
    const request=++locationRequest.current;
    setLatitude("");setLongitude("");setLocating(true);setLocationMessage("Allow location access when your browser asks. Finding your current position…");
    try {
      navigator.geolocation.getCurrentPosition(position=>{
        if(request!==locationRequest.current)return;
        const {latitude:lat,longitude:lng,accuracy}=position.coords;
        if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180) {setLocating(false);setLocationMessage("The device returned an invalid position. Try again or choose a demo location.");return;}
        setLatitude(lat.toFixed(6));setLongitude(lng.toFixed(6));setLocating(false);
        const precision=Number.isFinite(accuracy)&&accuracy>=0 ? ` (${locale==="my"?"ခန့်မှန်း တိကျမှု":"estimated accuracy"}: ${Math.ceil(accuracy)} m)` : "";
        setLocationMessage(locale==="my" ? `သင့်တည်နေရာ ရရှိပါပြီ${precision}။ မျှဝေရန် ကုန်ပို့မှု ပြောင်းလဲချက် သိမ်းရန်ကို နှိပ်ပါ။` : `Your device location is ready${precision}. Press Save shipment update to share it.`);
      },error=>{
        if(request!==locationRequest.current)return;
        setLocating(false);
        setLocationMessage(error.code===1 ? "Location permission was denied. Allow location access in your browser settings and retry, or use a demo location." : error.code===3 ? "Finding your location took too long. Try again outdoors with location services enabled, or use a demo location." : "Your location is unavailable. Check device location services and try again, or use a demo location.");
      },{enableHighAccuracy:true,timeout:15000,maximumAge:0});
    } catch {setLocating(false);setLocationMessage("Location could not start. Check your browser permissions or choose a demo location.");}
  }

  function isEffectivelyOffline(): boolean {
    return !navigator.onLine || !!(window as unknown as Record<string, boolean>).__simulatedOffline;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    if (!isEffectivelyOffline()) {
      // Online — let the normal server action handle it
      setQueuedMessage("");
      return;
    }
    // Offline — intercept and queue locally
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selectedStatus = (form.get("status") as string) || status;
    const lat = form.get("latitude") as string;
    const lng = form.get("longitude") as string;
    const parsedLat = lat && lat.trim() ? parseFloat(lat) : null;
    const parsedLng = lng && lng.trim() ? parseFloat(lng) : null;
    // Validate that if one coordinate is provided, both must be
    if ((parsedLat === null) !== (parsedLng === null)) {
      setQueuedMessage("Enter both coordinates or leave both blank.");
      return;
    }
    addToQueue({
      id: (form.get("id") as string) || requestId,
      userId: props.userId,
      shipmentId: shipment,
      shipmentNumber: props.shipmentNumber,
      status: selectedStatus as ShipmentStatus,
      note: ((form.get("note") as string) || "").trim(),
      latitude: parsedLat,
      longitude: parsedLng,
      occurredAt: (form.get("occurredAt") as string) || occurredAt,
      revision,
      syncStatus: "pending",
      queuedAt: new Date().toISOString(),
    });
    setQueuedMessage("Update saved to your offline queue. It will be sent when you sync.");
    window.dispatchEvent(new CustomEvent("offline-queue-updated"));
  }

  const choices=SHIPMENT_STATUSES.filter(value=>value!=="requested"&&SHIPMENT_STATUSES.indexOf(value)>=SHIPMENT_STATUSES.indexOf(status));
  return <section className="panel"><div className="panel-heading"><div><h2><T>Update shipment</T></h2><p className="panel-subtitle"><T>Status, note and location</T></p></div></div><form key={revision} action={action} onSubmit={handleSubmit} className="shipment-form driver-update-form" onInputCapture={capture} onChangeCapture={capture} onClickCapture={capture} onSubmitCapture={capture}>
    <Input type="hidden" name="id" value={state.requestId ?? requestId} /><Input type="hidden" name="shipment" value={shipment} /><Input type="hidden" name="revision" value={revision} /><Input type="hidden" name="occurredAt" value={state.occurredAt ?? occurredAt} />
    <fieldset disabled={pending}><legend><T>Progress update</T></legend><div className="form-field"><label htmlFor="driver-status"><T>Status</T></label><select id="driver-status" name="status" defaultValue={status}>{choices.map(value=><option key={value} value={value}><T>{SHIPMENT_STATUS_LABELS[value]}</T><T>{value===status ? " (current)" : ""}</T></option>)}</select></div><div className="form-field"><label htmlFor="driver-note"><T>Status note</T></label><Textarea id="driver-note" name="note" maxLength={2000} rows={3} placeholder="Checkpoint details, cargo condition or delivery note" /></div></fieldset>
    <fieldset disabled={pending}><legend><T>Location (optional)</T></legend><p className="form-help"><T>Use your phone’s location—no coordinates to type. Location is shared with shipment viewers only when you save this update.</T></p>
      <div className="gps-presets"><button type="button" className="button button-dark" onClick={useMyLocation} disabled={locating}><T>{locating ? "Finding my location…" : "Use my location"}</T></button>{locating&&<button type="button" className="button signout-button" onClick={()=>selectLocation("","","Location request cancelled. No new position will be shared.")}><T>Cancel location request</T></button>}<button type="button" className="button signout-button" onClick={()=>selectLocation("","","No new location selected. Your last saved location will be kept.")}><T>Clear location</T></button></div>
      <p role="status" aria-live="polite" className="location-status"><T>{locationMessage}</T></p>
      <details className="location-options"><summary><T>Demo locations</T></summary><p className="form-help"><T>Choose a simulated position for the assignment demo.</T></p><div className="gps-presets">{[["Yangon","16.8409","96.1735"],["Mandalay","21.9588","96.0891"],["Muse","23.9869","97.9040"],["Myawaddy","16.6891","98.5089"]].map(([name,lat,lng])=><button type="button" className="button signout-button" key={name} onClick={()=>selectLocation(lat,lng,locale==="my" ? `${t(name)} စမ်းသပ်တည်နေရာ ရွေးထားသည်။ မျှဝေရန် ကုန်ပို့မှု ပြောင်းလဲချက် သိမ်းရန်ကို နှိပ်ပါ။` : `${name} demo location selected. Press Save shipment update to share it.`)}><T>{name}</T></button>)}</div></details>
      <details className="location-options"><summary><T>Advanced: view or edit coordinates</T></summary><div className="form-grid"><div className="form-field"><label htmlFor="latitude"><T>Latitude</T></label><Input id="latitude" name="latitude" type="number" step="any" min={-90} max={90} value={latitude} onChange={event=>selectLocation(event.target.value,longitude,"Manual coordinates selected. Enter both values before saving.")} /></div><div className="form-field"><label htmlFor="longitude"><T>Longitude</T></label><Input id="longitude" name="longitude" type="number" step="any" min={-180} max={180} value={longitude} onChange={event=>selectLocation(latitude,event.target.value,"Manual coordinates selected. Enter both values before saving.")} /></div></div><small><T>Blank coordinates preserve the previous location.</T></small></details><noscript><T>Enable JavaScript to use device or demo locations. Manual coordinates are available under Advanced.</T></noscript>
    </fieldset>
    {queuedMessage && <p className="success-notice" role="status"><T>{queuedMessage}</T></p>}
    <p role="status" className={state.message ? "auth-error" : ""}><T>{state.message}</T></p>{state.message && <a href={`/driver/shipments/${shipment}`} className="text-link"><T>Reload latest shipment</T></a>}<button type="submit" className="button button-dark driver-save" disabled={pending||locating}><T>{pending ? "Saving update…" : "Save shipment update"}</T></button>
  </form></section>;
}
