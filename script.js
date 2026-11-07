// 【重要】ご家族専用の固定ID
const CAMERA_ID = 'baba-baby-cam-secret2026';

let peer = null;
let localStream = null;

const modeSelection = document.getElementById('mode-selection');
const cameraSection = document.getElementById('camera-section');
const monitorSection = document.getElementById('monitor-section');
const btnCamera = document.getElementById('btn-camera');
const btnMonitor = document.getElementById('btn-monitor');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const monitorStatus = document.getElementById('monitor-status');

// 【カメラとして使う（古いiPhone用）】
btnCamera.addEventListener('click', async () => {
  modeSelection.classList.add('hidden');
  cameraSection.classList.remove('hidden');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });
    localVideo.srcObject = localStream;

    peer = new Peer(CAMERA_ID);

    // モニターから着信があったら自分の映像を返す
    peer.on('call', (call) => {
      call.answer(localStream);
    });

  } catch (err) {
    alert('カメラの取得に失敗: ' + err);
  }
});

// 【モニターとして使う（Mac / iPad用）】
btnMonitor.addEventListener('click', () => {
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  peer = new Peer();

  peer.on('open', () => {
    // ★キャッシュ更新確認用の目印 (v3) を追加
    monitorStatus.textContent = "カメラを呼び出しています(v3)...";

    // ★安定化ハック：ダミーの空ストリームを作ってカメラに発信する
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
