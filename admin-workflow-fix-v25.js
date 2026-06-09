
/* CRAFTED-VISUAL-PRODUCT-MEDIA-INTEGRATION-FIX-20260609-25 */
window.refreshFabricDropdowns = function(){
  const fabrics = window.manualFabrics || [];
  document.querySelectorAll('.fabric-select').forEach(sel=>{
    const current = sel.value;
    sel.innerHTML = '<option value="">Select Fabric</option>' +
      fabrics.map(f=>`<option value="${f}">${f}</option>`).join('');
    sel.value = current;
  });
};

let mediaUploadInProgress = false;

window.safeUploadMedia = async function(file, existingMedia=[]){
  if(mediaUploadInProgress) return {skipped:true, reason:'busy'};
  if(existingMedia.some(x => x.name===file.name && x.size===file.size)){
    return {skipped:true, reason:'duplicate'};
  }
  mediaUploadInProgress = true
};
