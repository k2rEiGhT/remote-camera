const CAMERA_ID = 'baba-baby-cam-secret2026';
const SECRET_PIN = 'risaki';

let peer = null;
let localStream = null;
let useFrontCamera = false;

// UI要素の取得
const mainTitle = document.getElementById('main-title');
const modeSelection = document.getElementById('mode-selection');
const cameraSection = document.getElementById('camera-section');
const monitorSection = document.getElementById('monitor-section');
const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const cameraStatus = document.getElementById('camera-status');
const monitorStatus = document.getElementById('monitor-status');
const pinGroup = document.getElementById('pin-group');
const secretPinInput = document.getElementById('secret-pin');
const btnConnectSecure = document.getElementById('btn-connect-secure');
const btnFullscreen = document.getElementById('btn-fullscreen');

async function getCameraStream() {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  const mode = useFrontCamera ? "user" : "environment";
  localStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: true });
  localVideo.srcObject = localStream;
}

// 【カメラとして使う】
btnCamera.addEventListener('click', async () => {
  mainTitle.classList.add('hidden'); // タイトルを消して画面を広く使う
  modeSelection.classList.add('hidden');
  cameraSection.classList.remove('hidden');

  try {
    await getCameraStream();
    peer = new Peer(CAMERA_ID);

    peer.on('call', (call) => {
      if (call.metadata && call.metadata.pin === SECRET_PIN) {
        call.answer(localStream);
        cameraStatus.textContent = "🟢 モニター接続中"; // 接続状態をバッジに表示
      } else {
        call.close();
      }
    });
  } catch (err) {
    alert('カメラの取得に失敗: ' + err);
  }
});

// カメラ切り替え
if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener('click', async () => {
    useFrontCamera = !useFrontCamera;
    await getCameraStream();
    if (peer) {
      const newVideoTrack = localStream.getVideoTracks()[0];
      for (let conns in peer.connections) {
        peer.connections[conns].forEach(conn => {
          if (conn.peerConnection) {
            const sender = conn.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(newVideoTrack);
          }
        });
      }
    }
  });
}

// 【モニターとして使う】
btnMonitor.addEventListener('click', () => {
  mainTitle.classList.add('hidden'); // タイトルを消す
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  const savedPin = localStorage.getItem('savedBabyCamPin');
  if (savedPin) secretPinInput.value = savedPin;
});

btnConnectSecure.addEventListener('click', () => {
  const enteredPin = secretPinInput.value.trim();
  if (!enteredPin) return alert('合言葉を入力してください');

  localStorage.setItem('savedBabyCamPin', enteredPin);
  monitorStatus.textContent = "認証中(v7)...";

  peer = new Peer();
  peer.on('open', () => {
    const canvas = document.createElement('canvas');
    const call = peer.call(CAMERA_ID, canvas.captureStream(), { metadata: { pin: enteredPin } });

    call.on('stream', (remoteStream) => {
      // 映像を受信したら、合言葉入力欄とステータスを消して完全な全画面にする
      pinGroup.classList.add('hidden');
      monitorStatus.classList.add('hidden');
      btnFullscreen.classList.remove('hidden');

      remoteVideo.srcObject = remoteStream;
      remoteVideo.play().catch(e => { remoteVideo.controls = true; });
    });

    call.on('close', () => {
      monitorStatus.textContent = "切断されました";
      monitorStatus.classList.remove('hidden');
      btnFullscreen.classList.add('hidden');
    });
  });

  peer.on('error', (err) => {
    monitorStatus.textContent = err.type === 'peer-unavailable' ? "カメラが見つかりません。" : "通信エラー";
  });
});

// 全画面表示ボタン
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    if (remoteVideo.requestFullscreen) remoteVideo.requestFullscreen();
    else if (remoteVideo.webkitRequestFullscreen) remoteVideo.webkitRequestFullscreen();
    else if (remoteVideo.webkitEnterFullscreen) remoteVideo.webkitEnterFullscreen();
  });
}
