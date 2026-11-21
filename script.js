// ==========================================
// 設定・定数
// ==========================================
const CAMERA_ID = 'baba-baby-cam-secret2026';
const SECRET_PIN = 'risaki';

// ★TURNサーバー（中継役）の設定
// Meteredで取得した username / credential に書き換えてください
const peerConfig = {
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: 'turn:a.relay.metered.ca:80',
        username: 'ここに取得したusername',
        credential: 'ここに取得したcredential'
      },
      {
        urls: 'turn:a.relay.metered.ca:443?transport=tcp',
        username: 'ここに取得したusername',
        credential: 'ここに取得したcredential'
      }
    ]
  }
};

// ==========================================
// DOM要素の取得
// ==========================================
const modeSelection = document.getElementById('mode-selection');
const cameraView = document.getElementById('camera-view');
const monitorView = document.getElementById('monitor-view');

const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const btnSwitchCamera = document.getElementById('btn-switch-camera');

const pinInput = document.getElementById('pin-input');
const btnConnectSecure = document.getElementById('btn-connect-secure');
const pinContainer = document.getElementById('pin-container');

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
    modeSelection.classList.add('hidden');
    cameraView.classList.remove('hidden');
    cameraStatus.textContent = 'カメラ準備中...';

    await getCameraStream();

    peer = new Peer(CAMERA_ID, peerConfig);

    peer.on('open', (id) => {
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
    modeSelection.classList.add('hidden');
    monitorView.classList.remove('hidden');
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
    const enteredPin = pinInput.value.trim();
    if (enteredPin !== SECRET_PIN) {
      alert('合言葉が違います。');
      return;
    }

    if (pinContainer) pinContainer.classList.add('hidden');
    monitorStatus.textContent = '認証中(v10)...';

    peer = new Peer(peerConfig);

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

const videoContainer = document.querySelector('.video-container');

if (videoContainer) {
  videoContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      // 2本指（ピンチズーム開始）
      isPanning = false;
      startDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      startScale = currentScale;
    } else if (e.touches.length === 1 && currentScale > 1) {
      // 拡大中の1本指（スワイプで映像を移動）
      isPanning = true;
      startX = e.touches[0].clientX - pointX;
      startY = e.touches[0].clientY - pointY;
    }
  }, { passive: false });

  videoContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault(); // ズーム中の画面スクロールをブロック
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      currentScale = Math.min(Math.max(1, startScale * (currentDistance / startDistance)), 5); // 最大5倍まで
      updateVideoTransform();
    } else if (isPanning && currentScale > 1 && e.touches.length === 1) {
      e.preventDefault(); // 映像移動中の画面スクロールをブロック
      pointX = e.touches[0].clientX - startX;
      pointY = e.touches[0].clientY - startY;
      updateVideoTransform();
    }
  }, { passive: false });

  let lastTapTime = 0;
  videoContainer.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) startDistance = 0;
    if (e.touches.length === 0) isPanning = false;

    // 縮小しすぎた場合は元のサイズに戻す
    if (currentScale <= 1) {
      currentScale = 1;
      pointX = 0;
      pointY = 0;
      updateVideoTransform();
    }

    // ダブルタップで一気に拡大・リセット
    if (e.changedTouches.length === 1) {
      const currentTime = new Date().getTime();
      const tapLength = currentTime - lastTapTime;
      if (tapLength < 300 && tapLength > 0) {
        if (currentScale > 1) {
          currentScale = 1;
          pointX = 0;
          pointY = 0; // リセット
        } else {
          currentScale = 2.5; // 2.5倍に拡大
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
