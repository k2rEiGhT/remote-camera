// 【重要】ご家族専用の固定ID
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

    peer = new Peer(CAMERA_ID);

    // ★変更点：モニターからの「接続要求（合図）」を受け取ったら、映像を発信する
    peer.on('connection', (conn) => {
      // conn.peer にはモニター側のランダムIDが入っている
      peer.call(conn.peer, localStream);
    });

    peer.on('error', (err) => {
      console.error('カメラ側の通信エラー: ', err);
    });

  } catch (err) {
    alert('カメラまたはマイクの取得に失敗しました: ' + err);
  }
});

// 【モニターとして使う（iPad / 普段用iPhone用）】
btnMonitor.addEventListener('click', () => {
  modeSelection.classList.add('hidden');
  monitorSection.classList.remove('hidden');

  peer = new Peer();

  peer.on('open', () => {
    monitorStatus.textContent = "カメラを探しています...";
    // ★変更点：いきなりビデオ通話を発信せず、まずはデータ通信で「合図」を送る
    peer.connect(CAMERA_ID);
  });

  // カメラから映像が送られてきたら受ける
  peer.on('call', (call) => {
    call.answer(); // こちらからは映像を送らないので空でOK

    call.on('stream', (remoteStream) => {
      monitorStatus.textContent = "映像を受信しています";
      remoteVideo.srcObject = remoteStream;

      // ★iOSの自動再生ブロック対策を追加
      remoteVideo.play().catch(e => {
        console.error("自動再生がブロックされました:", e);
        monitorStatus.textContent = "映像をタップして再生してください";
        remoteVideo.controls = true; // コントロールバーを表示して手動再生可能にする
      });
    });
  });

  peer.on('error', (err) => {
    if (err.type === 'peer-unavailable') {
      monitorStatus.textContent = "カメラが見つかりません。寝室のiPhoneが起動しているか確認してください。";
    } else {
      monitorStatus.textContent = '通信エラー: ' + err.type;
    }
  });
});
