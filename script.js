// 【重要】ご家族専用の固定ID
// 世界で一意になるよう、推測されにくい文字列に変更して使ってください
const CAMERA_ID = 'baba-baby-cam-secret2026';

let peer = null;
let localStream = null;

// UI要素の取得
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
    // 映像（インカメラ）と音声を取得
    localStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: true
    });
    localVideo.srcObject = localStream;

    // 固定IDでPeerサーバーに接続して待機
    peer = new Peer(CAMERA_ID);

    // モニターから着信があったら、自分の映像ストリームを返す
    peer.on('call', (call) => {
      call.answer(localStream);
    });

    peer.on('error', (err) => {
      alert('カメラ側の通信エラー: ' + err.type);
    });

  } catch (err) {
    alert('カメラまたはマイクの取得に失敗しました: ' + err);
  }
});

// 【モニターとして使う（iPad / 普段用iPhone用）】
btnMonitor.addEventListener('click', () => {
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  // モニター側はランダムなIDでPeerサーバーに接続
  peer = new Peer();

  peer.on('open', () => {
    // Peerサーバーに繋がったら、即座にカメラの固定IDへ自動発信
    const call = peer.call(CAMERA_ID, null);

    // カメラ側から映像が返ってきたら再生
    call.on('stream', (remoteStream) => {
      monitorStatus.textContent = "映像を受信しています";
      remoteVideo.srcObject = remoteStream;
      // iOS Chrome/Safari対策として明示的にplay()を呼ぶ
      remoteVideo.play().catch(e => console.error("再生エラー:", e));
    });

    call.on('close', () => {
      monitorStatus.textContent = "カメラとの接続が切れました";
    });
  });

  peer.on('error', (err) => {
    // カメラ側がまだ起動していない場合のエラーハンドリング
    if (err.type === 'peer-unavailable') {
      monitorStatus.textContent = "カメラが見つかりません。寝室のiPhoneが起動しているか確認してください。";
    } else {
      monitorStatus.textContent = '通信エラー: ' + err.type;
    }
  });
});
