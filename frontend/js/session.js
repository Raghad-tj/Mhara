/**
 * SkillMentor - Frontend Session Manager
 * Handles API orchestration and session lifecycle states.
 */
class SkillSessionManager {
    constructor() {
        this.apiBaseUrl = "http://127.0.0.1:8000/api";
        this.currentSkillData = null;
        this.isSessionActive = false;
        this.currentScore = 100.0;
        this.feedbackLog = [];
        this.frameCounter = 0;
    }

    async startSession(skillId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/skills/${skillId}`);
            if (!response.ok) throw new Error("Failed to fetch criteria");
            
            this.currentSkillData = await response.json();
            this.isSessionActive = true;
            this.currentScore = 100.0;
            this.feedbackLog = [];
            this.frameCounter = 0;
            
            // Reset the detached scoring engine
            heuristicScorer.reset();
            
            console.log(`Session started: ${this.currentSkillData.name}`);
            this.startUiTimer(this.currentSkillData.session_duration_seconds);
        } catch (error) {
            console.error("Session Start Failure:", error);
        }
    }

   processFrame(landmarks) {
        // Ensure the session is actively running and skill configuration data is loaded
        if (!this.isSessionActive || !this.currentSkillData) return;

        this.frameCounter++;
        
        // Iterate through each clinical dimension defined in the JSON database configuration
        this.currentSkillData.dimensions.forEach(dimension => {
            // Extract the calculated geometric value (angle/distance) for the current frame
            const signalValue = this.calculatePoseSignal(dimension.pose_signal, landmarks);
            
            if (signalValue !== null) {
                // ==========================================
                // 1. GENERIC SPATIAL EVALUATION (All Skills)
                // ==========================================
                // Check static boundaries (min/max bounds) for immediate postural mistakes
                const evaluation = heuristicScorer.evaluateDimension(dimension, signalValue);
                this.triggerLiveFeedback(dimension.id, evaluation.feedback);
                
                // If a camera-noise-filtered posture violation is detected, apply penalty
                if (evaluation.shouldPenalize) {
                    this.currentScore = Math.max(0, this.currentScore - 2.0);
                    this.updateUiScore(this.currentScore);
                    this.feedbackLog.push(evaluation.feedback);
                }

                // ==========================================
                // 2. SKILL-SPECIFIC TEMPORAL HEURISTIC (CPR Only)
                // ==========================================
                // If the active skill is CPR and the target signal is the elbow angle, 
                // invoke the advanced rhythm tracking engine to calculate live BPM.
                if (this.currentSkillData.id === "cpr" && dimension.pose_signal === "elbow_angle") {
                    const rhythmEvaluation = heuristicScorer.evaluateCprRhythm(signalValue);
                    
                    // If a complete compression-release cycle was caught, update metrics
                    if (rhythmEvaluation) {
                        const bpmElement = document.getElementById("cpr-bpm-display");
                        const rhythmFeedbackElement = document.getElementById(`feedback-${dimension.id}`);
                        
                        // Render calculated speed metrics to the user interface safely
                        if (bpmElement) {
                            bpmElement.innerText = `BPM: ${rhythmEvaluation.bpm}`;
                        }
                        if (rhythmFeedbackElement) {
                            rhythmFeedbackElement.innerText = rhythmEvaluation.feedback;
                        }

                        // Penalize if the rolling average frequency falls outside 100-120 BPM
                        if (!rhythmEvaluation.isValid) {
                            this.currentScore = Math.max(0, this.currentScore - 1.0);
                            this.updateUiScore(this.currentScore);
                            this.feedbackLog.push(rhythmEvaluation.feedback);
                        }
                    }
                }
            }
        });
    }

    calculatePoseSignal(signalName, landmarks) {
        try {
            switch (signalName) {
                case "elbow_angle":
                    return this.computeAngle(landmarks[12], landmarks[14], landmarks[16]);
                case "shoulder_hip_angle":
                    return this.computeAngle(landmarks[12], landmarks[24], landmarks[26]);
                case "wrist_elbow_y_diff":
                    return landmarks[14].y - landmarks[16].y;
                case "wrist_to_navel_distance":
                    return this.computeDistance(landmarks[16], landmarks[24]);
                default:
                    return null;
            }
        } catch (e) {
            return null;
        }
    }

    computeAngle(p1, p2, p3) {
        let radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
        let angle = Math.abs((radians * 180.0) / Math.PI);
        if (angle > 180.0) angle = 360.0 - angle;
        return angle;
    }

    computeDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    triggerLiveFeedback(dimensionId, message) {
        if (this.frameCounter % 10 === 0) {
            const feedbackElement = document.getElementById(`feedback-${dimensionId}`);
            if (feedbackElement) feedbackElement.innerText = message;
        }
    }

    async endSession(studentName) {
        this.isSessionActive = false;
        
        const payload = {
            student_name: studentName,
            skill_id: this.currentSkillData.id,
            final_score: Math.round(this.currentScore),
            feedback_summary: [...new Set(this.feedbackLog)].slice(0, 5)
        };

        try {
            const response = await fetch(`${this.apiBaseUrl}/session/result`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (response.ok) this.displayFinalReport(payload);
        } catch (error) {
            console.error("Data Sync Failure:", error);
        }
    }

    startUiTimer(seconds) {
        let remaining = seconds;
        const timerInterval = setInterval(() => {
            if (!this.isSessionActive || remaining <= 0) {
                clearInterval(timerInterval);
                if (remaining <= 0) this.endSession("Abrar");
                return;
            }
            remaining--;
            const timerElement = document.getElementById("session-timer");
            if (timerElement) timerElement.innerText = `Time: ${remaining}s`;
        }, 1000);
    }

    updateUiScore(score) {
        const scoreElement = document.getElementById("session-score");
        if (scoreElement) scoreElement.innerText = `Score: ${Math.round(score)}%`;
    }

    displayFinalReport(data) {
        alert(`Assessment Complete!\nFinal Grade: ${data.final_score}%\nReview Items: ${data.feedback_summary.join(", ")}`);
    }
}

const sessionManager = new SkillSessionManager();