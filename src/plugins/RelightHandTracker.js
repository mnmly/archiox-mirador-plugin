import React from 'react';
import PropTypes from 'prop-types';
import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * The RelightHandTracker component integrates MediaPipe hand tracking to control the directional light.
 * It manages the webcam stream, runs hand detection, and emits position updates for the right hand's
 * index finger tip (landmark 8). It also renders a small canvas preview showing the detected hand landmarks.
 */
class RelightHandTracker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isReady: false,
      error: null,
      handDetected: false,
    };

    // Pinch gesture detection state
    this.lastPinchState = false;
    this.lastPinchTime = 0;
    this.PINCH_DEBOUNCE_MS = 500; // Prevent multiple rapid triggers
    this.PINCH_THRESHOLD = 0.05; // Distance threshold for pinch detection

    // MediaPipe and video references
    this.handLandmarker = null;
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();

    // Animation control
    this.animationFrameId = null;
    this.isDetecting = false;

    // Performance throttling
    this.lastUpdateTime = 0;
    this.UPDATE_THROTTLE_MS = 33; // ~30fps
  }

  /**
   * Initialize MediaPipe HandLandmarker with GPU acceleration
   */
  async initializeMediaPipe() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
      );

      this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numHands: 1, // Optimize performance - only need one hand
      });

      this.setState({ isReady: true });
    } catch (error) {
      console.error('Failed to initialize MediaPipe:', error);
      this.setState({
        error: 'Failed to load hand tracking model. Please refresh the page.',
      });
    }
  }

  /**
   * Start webcam stream
   */
  async startWebcam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.setState({
        error: 'Webcam access is not supported by your browser.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 480,
          facingMode: 'user',
        },
      });

      const video = this.videoRef.current;
      video.srcObject = stream;

      video.addEventListener('loadeddata', () => {
        this.startDetection();
      });
    } catch (error) {
      console.error('Failed to start webcam:', error);

      if (error.name === 'NotAllowedError') {
        this.setState({
          error:
            'Camera permission denied. Please allow camera access to use hand tracking.',
        });
      } else if (error.name === 'NotFoundError') {
        this.setState({
          error:
            'No camera found. Please connect a camera to use hand tracking.',
        });
      } else {
        this.setState({
          error: 'Failed to access camera. Please try again.',
        });
      }

      // Notify parent that hand tracking failed
      this.props.onHandPositionUpdate(null, null, false);
    }
  }

  /**
   * Stop webcam stream and cleanup
   */
  stopWebcam() {
    this.isDetecting = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const video = this.videoRef.current;
    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      video.srcObject = null;
    }

    // Clear canvas
    const canvas = this.canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    this.setState({ handDetected: false });
  }

  /**
   * Start the hand detection loop
   */
  startDetection() {
    if (!this.handLandmarker) {
      console.error('HandLandmarker not initialized');
      return;
    }

    this.isDetecting = true;

    const detectLoop = () => {
      if (!this.isDetecting) return;

      const now = performance.now();

      // Throttle updates to avoid overwhelming the render loop
      if (now - this.lastUpdateTime >= this.UPDATE_THROTTLE_MS) {
        const video = this.videoRef.current;

        if (video && video.readyState >= 2) {
          try {
            const results = this.handLandmarker.detectForVideo(video, now);
            this.processResults(results);
            this.lastUpdateTime = now;
          } catch (error) {
            console.error('Hand detection error:', error);
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(detectLoop);
    };

    detectLoop();
  }

  /**
   * Process MediaPipe detection results
   */
  processResults(results) {
    const canvas = this.canvasRef.current;
    const video = this.videoRef.current;
    const ctx = canvas.getContext('2d');

    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let offsetX = 0;
    let offsetY = 0;
    let drawWidth = 0;
    let drawHeight = 0;
    // Draw video feed first (as background)
    if (video && video.readyState >= 2) {
      ctx.save();
      // Mirror the video horizontally for better UX
      ctx.scale(-1, 1);

      // Calculate scaling to maintain aspect ratio (Letterboxing)
      const videoRatio = video.videoWidth / video.videoHeight;
      drawWidth = canvas.width;
      drawHeight = canvas.width / videoRatio;

      if (drawHeight > canvas.height) {
          drawHeight = canvas.height;
          drawWidth = canvas.height * videoRatio;
      }

      offsetX = (canvas.width - drawWidth) / 2;
      offsetY = (canvas.height - drawHeight) / 2;

      ctx.drawImage(video, -canvas.width + offsetX, offsetY, drawWidth, drawHeight);
      ctx.restore();
    }

    let handDetected = false;
    let handIndex = -1;

    if (results.handednesses && results.handednesses.length > 0) {
      // Just grab the first hand detected to simplify the UX
      handDetected = true;
      handIndex = 0;
    }

    if (handDetected && results.landmarks && results.landmarks[handIndex]) {
      const landmarks = results.landmarks[handIndex];
      this.drawLandmarks(ctx, landmarks, drawWidth, drawHeight, offsetX, offsetY);
      const indexFingerTip = landmarks[8];
      const thumbTip = landmarks[4];

      // Flip the X coordinate here to account for the mirrored canvas preview
      // This ensures that moving your hand to the right of the screen 
      // results in a higher X value.
      let correctedX = 1 - indexFingerTip.x;

      // Apply X-axis flip if enabled
      if (this.props.flipX) {
        correctedX = 1 - correctedX;
      }

      this.props.onHandPositionUpdate(correctedX, indexFingerTip.y, true);
      this.setState({ handDetected: true });

      // Detect pinch gesture (index finger + thumb)
      if (this.props.onPinchGesture) {
        const distance = Math.sqrt(
          Math.pow(indexFingerTip.x - thumbTip.x, 2) +
          Math.pow(indexFingerTip.y - thumbTip.y, 2) +
          Math.pow(indexFingerTip.z - thumbTip.z, 2)
        );

        const isPinching = distance < this.PINCH_THRESHOLD;
        const now = performance.now();

        // Trigger on pinch start (transition from not pinching to pinching)
        if (isPinching && !this.lastPinchState && now - this.lastPinchTime > this.PINCH_DEBOUNCE_MS) {
          this.props.onPinchGesture();
          this.lastPinchTime = now;
        }

        this.lastPinchState = isPinching;
      }
    } else {
      // Reset pinch state when hand is not detected
      this.lastPinchState = false;
      this.setState({ handDetected: false });
    }
  }

  /**
   * Draw hand landmarks on canvas
   */
/**
 * Draw hand landmarks on canvas with proportional scaling and mirroring
 */
drawLandmarks(ctx, landmarks, drawWidth, drawHeight, offsetX, offsetY) {
  const canvas = this.canvasRef.current;

  // 1. Setup the coordinate system
  ctx.save();
  
  // 2. Apply mirroring: Flip horizontally across the center of the canvas
  ctx.scale(-1, 1);
  ctx.translate(-canvas.width, 0);

  // 3. Define the hand connections (bones)
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], // Palm
  ];

  // 4. Draw connections
  ctx.strokeStyle = '#00FF00';
  ctx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];

    // Scale normalized MediaPipe coordinates (0-1) to the proportional draw area
    const sx = startPoint.x * drawWidth + offsetX;
    const sy = startPoint.y * drawHeight + offsetY;
    const ex = endPoint.x * drawWidth + offsetX;
    const ey = endPoint.y * drawHeight + offsetY;

    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  });

  // 5. Draw landmark points
  landmarks.forEach((landmark, index) => {
    const x = landmark.x * drawWidth + offsetX;
    const y = landmark.y * drawHeight + offsetY;

    ctx.fillStyle = index === 8 ? '#FF0000' : '#FFFFFF'; // Highlight index tip
    ctx.beginPath();
    ctx.arc(x, y, index === 8 ? 4 : 2, 0, 2 * Math.PI);
    ctx.fill();
  });

  ctx.restore();
}

  /**
   * React lifecycle: component mounted
   */
  componentDidMount() {
    this.initializeMediaPipe();

    if (this.props.enabled) {
      // Wait for MediaPipe to initialize before starting webcam
      const checkReady = setInterval(() => {
        if (this.state.isReady) {
          clearInterval(checkReady);
          this.startWebcam();
        }
      }, 100);
    }
  }

  /**
   * React lifecycle: props updated
   */
  componentDidUpdate(prevProps) {
    if (prevProps.enabled !== this.props.enabled) {
      if (this.props.enabled && this.state.isReady) {
        this.startWebcam();
      } else if (!this.props.enabled) {
        this.stopWebcam();
      }
    }
  }

  /**
   * React lifecycle: component will unmount
   */
  componentWillUnmount() {
    this.stopWebcam();

    // Dispose MediaPipe resources
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }

  /**
   * Render the component
   */
  render() {
    const { id, enabled, showDebugView } = this.props;
    const { error, handDetected } = this.state;

    if (!enabled) {
      return null;
    }

    // Always render video element (hidden) for tracking
    const videoElement = (
      <video
        ref={this.videoRef}
        autoPlay
        playsInline
        style={{ display: 'none' }}
      />
    );

    // Show error state
    if (error) {
      return (
        <div
          id={id}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          {videoElement}
          <div
            style={{
              width: '150px',
              height: '150px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ff6b6b',
              fontSize: '12px',
              textAlign: 'center',
              padding: '10px',
            }}
          >
            {error}
          </div>
        </div>
      );
    }

    // Show full debug view with canvas
    if (showDebugView) {
      return (
        <div
          id={id}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '8px',
            padding: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          }}
        >
          {videoElement}
          <canvas
            ref={this.canvasRef}
            width={150}
            height={150}
            style={{
              width: '150px',
              height: '150px',
              display: 'block',
              transform: 'scaleX(-1)', // Mirror the video for better UX
            }}
          />
          <div
            style={{
              color: handDetected ? '#00ff00' : '#ff6b6b',
              fontSize: '10px',
              textAlign: 'center',
              marginTop: '4px',
            }}
          >
            {handDetected ? 'Hand detected' : 'No hand detected'}
          </div>
        </div>
      );
    }

    // Show minimal notification when debug view is hidden
    return (
      <div
        id={id}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
      >
        {videoElement}
        <canvas
          ref={this.canvasRef}
          width={150}
          height={150}
          style={{ display: 'none' }}
        />
        <div
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            color: handDetected ? '#00ff00' : '#ff6b6b',
            fontSize: '12px',
            fontWeight: 'bold',
            textAlign: 'center',
            minWidth: '120px',
          }}
        >
          {handDetected ? '✓ Hand detected' : '✗ No hand detected'}
        </div>
      </div>
    );
  }
}

RelightHandTracker.propTypes = {
  /** The id prop is used to populate the html id property **/
  id: PropTypes.string.isRequired,
  /** The enabled prop controls whether hand tracking is active **/
  enabled: PropTypes.bool.isRequired,
  /** The showDebugView prop controls whether the debug canvas is visible **/
  showDebugView: PropTypes.bool,
  /** The flipX prop controls whether to invert the X-axis **/
  flipX: PropTypes.bool,
  /** The onHandPositionUpdate prop is a callback function that receives hand position updates **/
  onHandPositionUpdate: PropTypes.func.isRequired,
  /** The onPinchGesture prop is a callback function that is called when a pinch gesture is detected **/
  onPinchGesture: PropTypes.func,
};

RelightHandTracker.defaultProps = {
  showDebugView: true,
  flipX: false,
  onPinchGesture: null,
};

export default RelightHandTracker;
