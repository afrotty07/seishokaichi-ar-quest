// This same-origin frame isolates the WebGL engine and releases it when exploration ends.
let stream, controller, disposed = false;
const camera = document.querySelector('#camera');
function release() {
  disposed = true;
  stream?.getTracks().forEach(track => track.stop());
  controller?.dispose();
  controller = null;
}
window.stopTracking = release;
window.addEventListener('pagehide',release,{once:true});

window.startTracking = async ({config, player, found, lost, signal}) => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('secure');
  if (!window.AFRAME || !window.MINDAR) throw Error('library');
  signal.addEventListener('abort',release,{once:true});
  const targetResponse = await fetch(new URL(config.targetFile,parent.document.baseURI),{signal});
  if (!targetResponse.ok) throw Error('targets');
  const targetData = await targetResponse.arrayBuffer();
  stream = await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:640},height:{ideal:480}}});
  if (disposed) {release();return;}
  camera.srcObject = stream;
  await camera.play();
  camera.width = camera.videoWidth;
  camera.height = camera.videoHeight;
  const scene = document.createElement('a-scene');
  scene.setAttribute('embedded','');
  scene.setAttribute('xr-mode-ui','enabled:false');
  scene.setAttribute('device-orientation-permission-ui','enabled:false');
  scene.setAttribute('renderer','alpha:true; antialias:true; precision:mediump');
  const view = document.createElement('a-camera');
  view.setAttribute('position','0 0 0');
  view.setAttribute('look-controls','enabled:false');
  view.setAttribute('wasd-controls','enabled:false');
  scene.append(view);
  const anchors = new Map();
  for (const t of config.teachers) {
    const anchor = document.createElement('a-entity');
    anchor.setAttribute('mindar-image-target','targetIndex:'+t.targetIndex);
    anchor.addEventListener('targetFound',()=>found(t.id));
    anchor.addEventListener('targetLost',()=>lost(t.id));
    anchors.set(t.targetIndex,anchor);
    scene.append(anchor);
  }
  const ready = new Promise(resolve=>scene.addEventListener('renderstart',resolve,{once:true}));
  document.body.append(scene);
  await ready;
  if (disposed) return;
  controller = new MINDAR.IMAGE.Controller({
    inputWidth:camera.videoWidth,inputHeight:camera.videoHeight,maxTrack:1,missTolerance:2,warmupTolerance:2,
    // MindAR's adaptive filter damps small pose changes while responding to larger motion.
    filterMinCF:0.0018,filterBeta:0.12,
    onUpdate(data) {
      if (!disposed && data.type === 'updateMatrix') {
        anchors.get(data.targetIndex)?.components['mindar-image-target'].updateWorldMatrix(data.worldMatrix);
      }
    }
  });
  const {dimensions} = controller.addImageTargetsFromBuffer(targetData);
  if(dimensions.length !== config.teachers.length) throw Error('targets');
  const THREE = AFRAME.THREE;
  const texture = new THREE.VideoTexture(player.video);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false});
  for (const t of config.teachers) {
    const anchor = anchors.get(t.targetIndex);
    const [w,h] = dimensions[t.targetIndex];
    anchor.components['mindar-image-target'].setupMarker([w,h]);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1,h/w),material);
    anchor.setObject3D('clip',mesh);
    const updateClip = () => {
      const {videoWidth,videoHeight,readyState,error} = player.video;
      mesh.visible = player.selected === t.id && readyState >= 2 && videoWidth > 0 && videoHeight > 0 && !error;
      if (!mesh.visible) return;

      // Fill the photograph's rectangle, preserving the proportions of the video.
      const ratio = (w/h)/(videoWidth/videoHeight);
      const cropX = Math.min(1,ratio);
      const cropY = Math.min(1,1/ratio);
      texture.repeat.set(cropX,cropY);
      texture.offset.set((1-cropX)/2,(1-cropY)/2);
    };
    for (const event of ['loadeddata','playing','emptied','error','resize']) {
      player.video.addEventListener(event,updateClip,{signal});
    }
    updateClip();
  }
  const system = scene.systems['mindar-image-system'];
  Object.assign(system,{video:camera,controller,container:document.body});
  const resize = () => {if (!disposed) system._resize();};
  resize();
  window.addEventListener('resize',resize);
  await controller.dummyRun(camera);
  if (!disposed) controller.processVideo(camera);
};
