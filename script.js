// 【重要】ご家族専用の固定IDと接続用の合言葉
const CAMERA_ID = 'baba-baby-cam-secret2026';
const SECRET_PIN = 'risaki'; // ★ご指定の合言葉に変更しました

let peer = null;
let localStream = null;
let useFrontCamera = false; // 最初は画角の広い背面カメラ(environment)を使用

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
const monitorControls = document.getElementById('monitor-controls'); // ★追加: ボタン群
const btnPip = document.getElementById('btn-pip');                   // ★追加: PiP
const btnFullscreen = document.getElementById('btn-fullscreen');

// カメラ映像を取得する共通関数
async function getCameraStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
  }
  const mode = useFrontCamera ? "user" : "environment";
  localStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: mode },
    audio: true
  });
  localVideo.srcObject = localStream;
}

// 【カメラとして使う（古いiPhone用）】
btnCamera.addEventListener('click', async () => {
  mainTitle.classList.add('hidden'); // タイトルを消して画面を広く使う
  modeSelection.classList.add('hidden');
  cameraSection.classList.remove('hidden');

  try {
    await getCameraStream();
    peer = new Peer(CAMERA_ID);

    peer.on('call', (call) => {
      // モニター側から送られてきたパスワードを検証
      if (call.metadata && call.metadata.pin === SECRET_PIN) {
        call.answer(localStream);
        cameraStatus.textContent = "🟢 モニター接続中"; // 接続状態をバッジに表示
      } else {
        console.warn('合言葉が一致しないため、通信をブロックしました');
        call.close();
      }
    });

  } catch (err) {
    alert('カメラの取得に失敗: ' + err);
  }
});

// カメラ切り替え（通信中も途切れず切り替え可能）
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

// 【モニターモードへ遷移する（Mac / iPad / 普段用iPhone用）】
btnMonitor.addEventListener('click', () => {
  mainTitle.classList.add('hidden'); // タイトルを消す
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  const savedPin = localStorage.getItem('savedBabyCamPin');
  if (savedPin) {
    secretPinInput.value = savedPin;
  }
});

// 【パスワードを送信して接続する】
btnConnectSecure.addEventListener('click', () => {
  const enteredPin = secretPinInput.value.trim();

  if (!enteredPin) {
    alert('合言葉を入力してください');
    return;
  }

  // 次回から入力を省略できるように localStorage に保存
  localStorage.setItem('savedBabyCamPin', enteredPin);
  monitorStatus.textContent = "認証中(v10)...";

  peer = new Peer();

  peer.on('open', () => {
    // 安定化ハック：ダミーの空ストリームを作って発信
    const canvas = document.createElement('canvas');
    const dummyStream = canvas.captureStream();

    // 接続要求に metadata としてパスワードを添付する
    const call = peer.call(CAMERA_ID, dummyStream, {
      metadata: { pin: enteredPin }
    });

    call.on('stream', (remoteStream) => {
      // 映像を受信したら、合言葉入力欄とステータスを消してボタン群を表示
      pinGroup.classList.add('hidden');
      monitorStatus.classList.add('hidden');
      monitorControls.classList.remove('hidden');

      remoteVideo.srcObject = remoteStream;
      remoteVideo.play().catch(e => {
        remoteVideo.controls = true;
      });
    });

    call.on('close', () => {
      monitorStatus.textContent = "切断されました";
      monitorStatus.classList.remove('hidden');
      monitorControls.classList.add('hidden');
    });
  });

  peer.on('error', (err) => {
    if (err.type === 'peer-unavailable') {
      monitorStatus.textContent = "カメラが見つかりません。iPhoneが起動しているか確認してください。";
    } else {
      monitorStatus.textContent = "通信エラー: " + err.type;
    }
  });
});

// 小窓（PiP）表示ボタンの処理
if (btnPip) {
  btnPip.addEventListener('click', async () => {
    try {
      if (document.pictureInPictureElement) {
        // すでにPiP状態なら元に戻す
        await document.exitPictureInPicture();
      } else if (remoteVideo.requestPictureInPicture) {
        // 標準のPiP API
        await remoteVideo.requestPictureInPicture();
      } else if (remoteVideo.webkitSetPresentationMode) {
        // iOS Safari専用のPiP API（古い機種対応用）
        remoteVideo.webkitSetPresentationMode('picture-in-picture');
      }
    } catch (error) {
      console.error(error);
      alert("このブラウザは小窓表示に対応していません。");
    }
  });
}

// 全画面表示ボタンの処理
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    // ★変更：映像単体ではなく、ボタンも含む「枠（コンテナ）」ごと全画面にする
    const container = document.querySelector('.video-container');
    if (container.requestFullscreen) {
      container.requestFullscreen(); // Mac / iPad用
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen(); // 古いSafari用
    } else if (remoteVideo.webkitEnterFullscreen) {
      remoteVideo.webkitEnterFullscreen(); // iPhone用（ネイティブプレイヤー起動）
    }
  });
}

// ==========================================
// ★追加：タッチ操作（リロード、ズーム、スワイプ）の統合処理
// ==========================================
let touchStartY = 0;
let isPulling = false;
let currentScale = 1;
let startDistance = 0;
let startScale = 1;
let isPanning = false;
let pointX = 0;
let pointY = 0;
let startX = 0;
let startY = 0;

const videoContainer = document.querySelector('.video-container');

// 1. 画面全体へのタッチ（引っ張ってリロード判定用）
document.addEventListener('touchstart', (e) => {
  // 拡大していない時の1本指タッチのみリロード準備
  if (e.touches.length === 1 && currentScale === 1) {
    touchStartY = e.touches[0].clientY;
    isPulling = true;
  }
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  if (isPulling && currentScale === 1) {
    const pullDistance = e.touches[0].clientY - touchStartY;
    if (pullDistance > 150) {
      isPulling = false;
      document.body.style.transition = 'opacity 0.2s ease';
      document.body.style.opacity = '0.3';
      setTimeout(() => location.reload(), 200);
    }
  }
}, { passive: true });

// 2. 映像エリアへのタッチ（ズーム＆パン操作）
videoContainer.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    // 2本指（ピンチズーム開始）
    isPulling = false;
    isPanning = false;
    startDistance = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
    startScale = currentScale;
  } else if (e.touches.length === 1 && currentScale > 1) {
    // 拡大中の1本指（スワイプで映像を移動）
    isPulling = false;
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
    currentScale = 1; pointX = 0; pointY = 0;
    updateVideoTransform();
  }

  // 3. ダブルタップで一気に拡大・リセット
  if (e.changedTouches.length === 1) {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTapTime;
    if (tapLength < 300 && tapLength > 0) {
      if (currentScale > 1) {
        currentScale = 1; pointX = 0; pointY = 0; // リセット
      } else {
        currentScale = 2.5; // 2.5倍に拡大
      }
      updateVideoTransform();
      e.preventDefault();
    }
    lastTapTime = currentTime;
  }
});

function updateVideoTransform() {
  remoteVideo.style.transform = `translate(${pointX}px, ${pointY}px) scale(${currentScale})`;
}
