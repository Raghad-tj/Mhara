/**
 * SkillMentor - High-Performance Camera & MediaPipe Pose Pipeline
 * Optimized for low-latency Edge AI processing during live international demos.
 */

class SkillCameraManager {
    constructor() {
        this.videoElement = null;
        this.canvasElement = null;
        this.canvasCtx = null;
        this.pose = null;
        this.camera = null;
        this.isPipelineReady = false;
    }

    /**
     * Initializes DOM elements, media streams, and MediaPipe configurations
     * @param {string} videoId - HTML ID of the hidden or visible video tag
     * @param {string} canvasId - HTML ID of the canvas for skeletal overlay rendering
     */
    async initializePipeline(videoId, canvasId) {
        this.videoElement = document.getElementById(videoId);
        this.canvasElement = document.getElementById(canvasId);
        
        if (!this.videoElement || !this.canvasElement) {
            console.error("Critical Error: Core UI pipeline elements missing from DOM.");
            return;
        }

        this.canvasCtx = this.canvasElement.getContext("2d");

        // Initialize MediaPipe Pose Solution using optimized Google CDN resources
        this.pose = new Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        // Set production runtime configurations for structural accuracy
        this.pose.setOptions({
            modelComplexity: 1,         // Balanced profile: high fidelity without dropping frame rates
            smoothLandmarks: true,      // Active temporal filtering to suppress hardware camera jitter
            enableSegmentation: false,  // Disabled background removal to maximize CPU/GPU thread performance
            minDetectionConfidence: 0.65,
            minTrackingConfidence: 0.65
        });

        // Register the stream processor callback
        this.pose.onResults((results) => this.onPoseFrameResults(results));

        // Request device hardware permissions and orchestrate web-camera lifecycle
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: { ideal: 30 } },
                audio: false
            });
            this.videoElement.srcObject = stream;
            
            // Instantiate the MediaPipe helper utility to poll frames efficiently
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    // Only feed frames into the AI if a skill training session is currently active
                    if (window.sessionManager?.isSessionActive) {
    await this.pose.send({ image: this.videoElement });
}
                },
                width: 640,
                height: 480
            });

            this.camera.start();
            this.isPipelineReady = true;
            console.log("Edge AI Camera Pipeline operational and listening for active sessions.");
        } catch (error) {
            console.error("Hardware Access Failure: Verify webcam connections and permissions.", error);
        }
    }

    /**
     * Internal callback handling normalized data points emitted by MediaPipe
     */
    onPoseFrameResults(results) {
        // Clear previous canvas buffer to redraw the new frame sequence
        this.canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
        
        // Render the raw camera stream as the background layer
        this.canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);

        if (!results.poseLandmarks) return;

        // Draw the visual skeletal mesh overlay so the judges can see the AI tracking live
        drawConnectors(this.canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 4 });
        drawLandmarks(this.canvasCtx, results.poseLandmarks, { color: '#FF0000', lineWidth: 2, radius: 4 });

        // Dispatch the exact 33 coordinate matrices to our centralized engineering manager
        if (window.sessionManager?.isSessionActive) {
    window.sessionManager.processFrame(results.poseLandmarks);
}
    }
}

// Global scope initialization
const skillCameraManager = new SkillCameraManager();