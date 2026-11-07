// 【重要】ご家族専用の固定IDと、接続用のパスワード
const CAMERA_ID = 'baba-baby-cam-secret2026';
const SECRET_PIN = 'risaki'; // 任意のパスワードに変更可能です

let peer = null;
let localStream = null;
let useFrontCamera = false; // 最初は画角の広い背面カメラ(environment)を使用する設定

// UI要素の取得
const modeSelection = document.getElementById('mode-selection');
const cameraSection = document.getElementById('camera-section');
const monitorSection = document.getElementById('monitor-section');
const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const btnSwitchCamera = document.getElementById('btn-switch-camera');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const monitorStatus = document.getElementById('monitor-status');
const secretPinInput = document.getElementById('secret-pin');
const btnConnectSecure = document.getElementById('btn-connect-secure');

// カメラ映像を取得する共通関数
async function getCameraStream() {
  if (localStream) {
    // すでにカメラが動いていたら一度止める
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
  modeSelection.classList.add('hidden');
  cameraSection.classList.remove('hidden');

  try {
    await getCameraStream();

    peer = new Peer(CAMERA_ID);

    // モニターから着信があった際の処理
    peer.on('call', (call) => {
      // モニター側から送られてきたパスワードを検証
      if (call.metadata && call.metadata.pin === SECRET_PIN) {
        call.answer(localStream); // パスワードが一致したら映像を返す
      } else {
        console.warn('パスワードが一致しないため、通信をブロックしました');
        call.close();
      }
    });

  } catch (err) {
    alert('カメラの取得に失敗: ' + err);
  }
});

// カメラ切り替えボタンの処理（通信中も途切れず切り替え可能）
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
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            }
          }
        });
      }
    }
  });
}

// 【モニターモードへ遷移する（Mac / iPad用）】
btnMonitor.addEventListener('click', () => {
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  // 前回入力したパスワードがブラウザに保存されていれば自動入力する
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

  // 次回から入力を省略できるように localStorage にパスワードを保存
  localStorage.setItem('savedBabyCamPin', enteredPin);

  monitorStatus.textContent = "認証して呼び出しています(v5)...";

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
      monitorStatus.textContent = "映像を受信しました";
      remoteVideo.srcObject = remoteStream;
      remoteVideo.play().catch(e => {
        monitorStatus.textContent = "自動再生ブロック: 映像をタップしてください";
        remoteVideo.controls = true;
      });
    });

    call.on('close', () => {
      monitorStatus.textContent = "合言葉が間違っているか、カメラが切断されました";
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
