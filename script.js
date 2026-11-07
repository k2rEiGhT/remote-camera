// 【重要】ご家族専用の固定ID
const CAMERA_ID = 'baba-baby-cam-secret2026';

let peer = null;
let localStream = null;
let useFrontCamera = false; // ★最初は背面カメラ(environment)を使用する設定

const modeSelection = document.getElementById('mode-selection');
const cameraSection = document.getElementById('camera-section');
const monitorSection = document.getElementById('monitor-section');
const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const btnSwitchCamera = document.getElementById('btn-switch-camera'); // ★追加
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const monitorStatus = document.getElementById('monitor-status');

// ★追加：カメラ映像を取得する共通関数
async function getCameraStream() {
  if (localStream) {
    // すでにカメラが動いていたら一度止める（カメラ使用中のランプを消すため）
    localStream.getTracks().forEach(track => track.stop());
  }

  // useFrontCameraがtrueならインカメラ、falseなら背面カメラ
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
    await getCameraStream(); // ★カメラ取得関数を呼び出し

    peer = new Peer(CAMERA_ID);

    peer.on('call', (call) => {
      call.answer(localStream);
    });

  } catch (err) {
    alert('カメラの取得に失敗: ' + err);
  }
});

// ★追加：カメラ切り替えボタンの処理
if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener('click', async () => {
    useFrontCamera = !useFrontCamera; // モードを反転させる
    await getCameraStream(); // 新しいカメラを取得し直す

    // すでにモニターと通信中の場合、送信している映像データを新しいカメラのものに差し替える
    if (peer) {
      const newVideoTrack = localStream.getVideoTracks()[0];
      // 通信中のすべての接続先（モニター）を探して映像を切り替える
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

// 【モニターとして使う（Mac / iPad用）】
btnMonitor.addEventListener('click', () => {
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  peer = new Peer();

  peer.on('open', () => {
    monitorStatus.textContent = "カメラを呼び出しています(v4)...";

    // ダミーの空ストリームを作ってカメラに発信する
    const canvas = document.createElement('canvas');
    const dummyStream = canvas.captureStream();

    const call = peer.call(CAMERA_ID, dummyStream);

    call.on('stream', (remoteStream) => {
      monitorStatus.textContent = "映像を受信しました";
      remoteVideo.srcObject = remoteStream;
      remoteVideo.play().catch(e => {
        monitorStatus.textContent = "自動再生ブロック: 映像をタップしてください";
        remoteVideo.controls = true;
      });
    });

    call.on('error', (err) => {
      monitorStatus.textContent = "通話エラー: " + err;
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
