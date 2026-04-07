import React from 'react';
import PropTypes from 'prop-types';
import { createHandpose } from '@svenflow/micro-handpose';

class RelightMicroHandTracker extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      isReady: false,
      error: null,
      handDetected: false,
    };

    this.detector = null;
    this.videoRef = React.createRef();
    this.canvasRef = React.createRef();

    this.animationFrameId = null;
    this.isDetecting = false;

    this.lastUpdateTime = 0;
    this.UPDATE_THROTTLE_MS = 33;
  }

  async componentDidMount() {
    try {
      await this.initializeHandpose();
      await this.startWebcam();
    } catch (error) {
      console.error(
        '[RelightMicroHandTracker] Failed to initialize hand tracker:',
        error
      );
      this.setState({
        error: 'Failed to load hand tracking. Please check camera permissions.',
      });
    }
  }

  async componentWillUnmount() {
    this.stopDetection();
    if (this.detector) {
      await this.detector.dispose();
    }
    if (this.videoRef.current && this.videoRef.current.srcObject) {
      const stream = this.videoRef.current.srcObject;
      if (stream.getTracks) {
        stream.getTracks().forEach((track) => track.stop());
      }
    }
  }

  async initializeHandpose() {
    try {
      this.detector = await createHandpose({
        scoreThreshold: 0.5,
        palmScoreThreshold: 0.5,
        maxHands: 1,
      });
      this.setState({ isReady: true });
    } catch (error) {
      console.error(
        '[RelightMicroHandTracker] Failed to initialize detector:',
        error
      );
      throw error;
    }
  }

  async startWebcam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Webcam access is not supported by your browser.');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
      });

      const video = this.videoRef.current;
      video.srcObject = stream;

      video.addEventListener('loadeddata', () => {
        this.startDetection();
      });
    } catch (error) {
      console.error('[RelightMicroHandTracker] Failed to start webcam:', error);
      throw error;
    }
  }

  async startDetection() {
    if (this.isDetecting) return;
    this.isDetecting = true;
    this.detectLoop();
  }

  stopDetection() {
    this.isDetecting = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  async detectLoop() {
    if (!this.isDetecting || !this.detector || !this.videoRef.current) return;

    const now = Date.now();
    if (now - this.lastUpdateTime < this.UPDATE_THROTTLE_MS) {
      this.animationFrameId = requestAnimationFrame(() => this.detectLoop());
      return;
    }

    try {
      const hands = await this.detector.detect(this.videoRef.current);

      if (hands && hands.length > 0) {
        const hand = hands[0];
        const indexTip = hand.keypoints.index_tip;

        if (indexTip) {
          this.lastUpdateTime = now;
          this.setState({ handDetected: true });

          if (this.props.onHandUpdate) {
            this.props.onHandUpdate(indexTip.x, indexTip.y);
          }
        } else {
          this.setState({ handDetected: false });
        }
      } else {
        this.setState({ handDetected: false });
      }
    } catch (error) {
      console.error('[RelightMicroHandTracker] Detection error:', error);
    }

    this.animationFrameId = requestAnimationFrame(() => this.detectLoop());
  }

  render() {
    const { isReady, error } = this.state;

    return (
      <div className="relight-hand-tracker">
        {error && <div className="hand-tracker-error">{error}</div>}

        <video
          ref={this.videoRef}
          style={{
            width: '200px',
            height: 'auto',
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 1000,
            display: isReady ? 'block' : 'none',
          }}
          autoPlay
          playsInline
          muted
        />

        {isReady && (
          <canvas
            ref={this.canvasRef}
            width="640"
            height="480"
            style={{
              position: 'fixed',
              bottom: '20px',
              right: '20px',
              zIndex: 1001,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    );
  }
}

export default RelightMicroHandTracker;

RelightMicroHandTracker.propTypes = {
  onHandUpdate: PropTypes.func.isRequired,
  rotation: PropTypes.number,
  flipped: PropTypes.bool,
};
