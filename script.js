// ==========================================
// 設定・定数
// ==========================================
const CAMERA_ID = 'baba-baby-cam-secret2026';
const SECRET_PIN = 'risaki';

// ★TURNサーバー（中継役）の設定
const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: "stun:stun.relay.metered.ca:80",
      },
      {
        urls: "turn:global.relay.metered.ca:80",
        username: "c9ad8815b23dfe694ff330ae",
        credential: "DXwyP/xdU/ENgmcP",
      },
      {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: "c9ad8815b23dfe694ff330ae",
        credential: "DXwyP/xdU/ENgmcP",
      },
      {
        urls: "turn:global.relay.metered.ca:443",
        username: "c9ad8815b23dfe694ff330ae",
        credential: "DXwyP/xdU/ENgmcP",
      },
      {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: "c9ad8815b23dfe694ff330ae",
        credential: "DXwyP/xdU/ENgmcP",
      },
    ]
  }
};

// ==========================================
// DOM要素の取得（index.htmlのIDに完全一致）
// ==========================================
const mainTitle = document.getElementById('main-title');
const modeSelection = document.getElementById('mode-selection');
const cameraSection = document.getElementById('camera-section');
const monitorSection = document.getElementById('monitor-section');

const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const btnSwitchCamera = document.getElementById('btn-switch-camera');

const pinGroup = document.getElementById('pin-group');
const secretPinInput = document.getElementById('secret-pin');
const btnConnectSecure = document.getElementById('btn-connect-secure');

const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const cameraStatus = document.getElementById('camera-status');
const monitorStatus = document.getElementById('monitor-status');

const monitorControls = document.getElementById('monitor-controls');
const btnPip = document.getElementById('btn-pip');
const btnFullscreen = document.getElementById('btn-fullscreen');

// ==========================================
// 状態管理変数
// ==========================================
let peer = null;
let localStream = null;
let currentCall = null;
let currentFacingMode = 'environment'; // 初期値は外カメラ

// ==========================================
// カメラ側の処理
// ==========================================
async function getCameraStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: true
    });
    localVideo.srcObject = localStream;
    localVideo.muted = true; // ハウリング防止
  } catch (err) {
    console.error('カメラ・マイクの取得に失敗:', err);
    cameraStatus.textContent = 'カメラの起動に失敗しました。権限を確認してください。';
  }
}

if (btnCamera) {
  btnCamera.addEventListener('click', async () => {
    if (mainTitle) mainTitle.classList.add('hidden');
    modeSelection.classList.add('hidden');
    cameraSection.classList.remove('hidden');
    cameraStatus.textContent = 'カメラ準備中...';

    await getCameraStream();

    peer = new Peer(CAMERA_ID, peerConfig);

    peer.on('open', () => {
      cameraStatus.textContent = '待機中（接続可能）';
    });

    peer.on('call', (call) => {
      currentCall = call;
      call.answer(localStream);
      cameraStatus.textContent = 'モニター接続中';

      call.on('close', () => {
        cameraStatus.textContent = '待機中（接続可能）';
      });
    });

    peer.on('error', (err) => {
      console.error('Peerエラー:', err);
      cameraStatus.textContent = 'エラー: ' + err.type;
    });
  });
}

// カメラ切り替え（内カメラ ⇔ 外カメラ）
if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener('click', async () => {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';
    await getCameraStream();

    // 通話中の場合は送信している映像トラックを差し替える
    if (currentCall && currentCall.peerConnection) {
      const videoTrack = localStream.getVideoTracks()[0];
      const sender = currentCall.peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender && videoTrack) {
        sender.replaceTrack(videoTrack);
      }
    }
  });
}

// ==========================================
// モニター側の処理
// ==========================================
if (btnMonitor) {
  btnMonitor.addEventListener('click', () => {
    if (mainTitle) mainTitle.classList.add('hidden');
    modeSelection.classList.add('hidden');
    monitorSection.classList.remove('hidden');

    const savedPin = localStorage.getItem('baby_cam_pin');
    if (savedPin && secretPinInput) {
      secretPinInput.value = savedPin;
    }
  });
}

// 空のダミーストリーム生成（モニター側から映像・音声を送らないため）
function createEmptyStream() {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext('2d');
  ctx.fillRect(0, 0, 1, 1);
  return canvas.captureStream(1);
}

if (btnConnectSecure) {
  btnConnectSecure.addEventListener('click', () => {
    const enteredPin = secretPinInput.value.trim();
    if (enteredPin !== SECRET_PIN) {
      alert('合言葉が違います。');
      return;
    }

    localStorage.setItem('baby_cam_pin', enteredPin);

    if (pinGroup) pinGroup.classList.add('hidden');
    monitorStatus.textContent = '認証中(v10)...';

    peer = new Peer(undefined, peerConfig);

    peer.on('open', () => {
      monitorStatus.textContent = 'カメラへ接続中...';
      const dummyStream = createEmptyStream();
      const call = peer.call(CAMERA_ID, dummyStream);

      call.on('stream', (remoteStream) => {
        remoteVideo.srcObject = remoteStream;
        monitorStatus.classList.add('hidden');
        if (monitorControls) monitorControls.classList.remove('hidden');

        // 自動再生（ブロックされた場合は標準コントローラーを表示）
        remoteVideo.play().catch(err => {
          console.warn('自動再生がブロックされました:', err);
          remoteVideo.controls = true;
        });
      });

      call.on('close', () => {
        monitorStatus.classList.remove('hidden');
        monitorStatus.textContent = '接続が切れました';
      });

      call.on('error', (err) => {
        console.error('通話エラー:', err);
        monitorStatus.classList.remove('hidden');
        monitorStatus.textContent = '接続エラーが発生しました';
      });
    });

    peer.on('error', (err) => {
      console.error('Peerエラー:', err);
      monitorStatus.classList.remove('hidden');
      monitorStatus.textContent = 'エラー: ' + err.type;
    });
  });
}

// ==========================================
// 小窓（PiP）表示ボタンの処理
// ==========================================
if (btnPip) {
  btnPip.addEventListener('click', async () => {
    // iPhone/iPadのホーム画面からアプリとして起動しているかを判定
    if (window.navigator.standalone) {
      alert("【iOSの制限により起動できません】\nホーム画面のアイコンから開いた場合、iPhoneの仕様で小窓表示がブロックされます。\n\n小窓表示を使いたい場合は、Safariなどのブラウザから直接開いてください。");
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (remoteVideo.requestPictureInPicture) {
        await remoteVideo.requestPictureInPicture();
      } else if (remoteVideo.webkitSetPresentationMode) {
        remoteVideo.webkitSetPresentationMode('picture-in-picture');
      }
    } catch (error) {
      console.error(error);
      alert("このブラウザは小窓表示に対応していません。");
    }
  });
}

// ==========================================
// 全画面表示ボタンの処理（映像単体をフルスクリーン化）
// ==========================================
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    if (remoteVideo.requestFullscreen) {
      remoteVideo.requestFullscreen(); // Mac / iPad用
    } else if (remoteVideo.webkitRequestFullscreen) {
      remoteVideo.webkitRequestFullscreen(); // 古いSafari用
    } else if (remoteVideo.webkitEnterFullscreen) {
      remoteVideo.webkitEnterFullscreen(); // iPhone用（ネイティブプレイヤー起動）
    }
  });
}

// ==========================================
// タッチ操作（ズーム、パン、ダブルタップ）の処理
// ==========================================
let currentScale = 1;
let startDistance = 0;
let startScale = 1;
let isPanning = false;
let pointX = 0;
let pointY = 0;
let startX = 0;
let startY = 0;

// モニター側の映像コンテナのみを対象にする
const monitorVideoContainer = document.querySelector('#monitor-section .video-container');

if (monitorVideoContainer) {
  monitorVideoContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      isPanning = false;
      startDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      startScale = currentScale;
    } else if (e.touches.length === 1 && currentScale > 1) {
      isPanning = true;
      startX = e.touches[0].clientX - pointX;
      startY = e.touches[0].clientY - pointY;
    }
  }, { passive: false });

  monitorVideoContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      currentScale = Math.min(Math.max(1, startScale * (currentDistance / startDistance)), 5);
      updateVideoTransform();
    } else if (isPanning && currentScale > 1 && e.touches.length === 1) {
      e.preventDefault();
      pointX = e.touches[0].clientX - startX;
      pointY = e.touches[0].clientY - startY;
      updateVideoTransform();
    }
  }, { passive: false });

  let lastTapTime = 0;
  monitorVideoContainer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) startDistance = 0;
    if (e.touches.length === 0) isPanning = false;

    if (currentScale <= 1) {
      currentScale = 1;
      pointX = 0;
      pointY = 0;
      updateVideoTransform();
    }

    if (e.changedTouches.length === 1) {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTapTime;
      if (tapLength < 300 && tapLength > 0) {
        if (currentScale > 1) {
          currentScale = 1;
          pointX = 0;
          pointY = 0;
        } else {
          currentScale = 2.5;
        }
        updateVideoTransform();
        e.preventDefault();
      }
      lastTapTime = currentTime;
    }
  });
}

function updateVideoTransform() {
  remoteVideo.style.transform = `translate(${pointX}px, ${pointY}px) scale(${currentScale})`;
}
