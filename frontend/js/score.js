/**
 * SkillMentor - Unified Heuristic Scoring Engine (Edge AI)
 * Handles both generic spatial validation and skill-specific temporal logic.
 */
class HeuristicScorer {
    constructor() {
        this.violationCounters = {};
        
        // CPR Specific Temporal State
        this.cprState = {
            lastDepthStatus: "up", // up, down
            compressionTimes: [],
            lastCompressionTimestamp: null
        };
    }

    /**
     * Resets the entire scoring memory at the start of any new session
     */
    reset() {
        this.violationCounters = {};
        this.cprState = {
            lastDepthStatus: "up",
            compressionTimes: [],
            lastCompressionTimestamp: null
        };
    }

    /**
     * [المحرك العام لكل المهارات]
     * Validates generic spatial layout (Angles, Distances) against JSON bounds
     */
    evaluateDimension(dimension, signalValue) {
        if (dimension.perfect_min === null || dimension.perfect_max === null) {
            return { isValid: true, feedback: dimension.good_feedback, shouldPenalize: false };
        }

        const isValid = signalValue >= dimension.perfect_min && signalValue <= dimension.perfect_max;
        let shouldPenalize = false;

        if (!isValid) {
            if (!this.violationCounters[dimension.id]) {
                this.violationCounters[dimension.id] = 0;
            }
            this.violationCounters[dimension.id]++;
            
            // Heuristic filter for camera noise (15 frames = ~0.5 seconds)
            if (this.violationCounters[dimension.id] % 15 === 0) {
                shouldPenalize = true;
            }
        } else {
            this.violationCounters[dimension.id] = 0;
        }

        return {
            isValid: isValid,
            feedback: isValid ? dimension.good_feedback : dimension.bad_feedback,
            shouldPenalize: shouldPenalize
        };
    }

    /**
     * [المحرك الخاص بالإنعاش القلبي فقط]
     * Advanced Temporal Heuristic to calculate Compression Rate (BPM)
     * @param {number} currentElbowAngle - Evaluated from landmarks
     * @returns {Object|null} Live BPM feedback or null if cycle incomplete
     */
    evaluateCprRhythm(currentElbowAngle) {
        const currentTime = performance.now();
        const compressionThreshold = 130; // زاوية النزول (الضغط)
        const releaseThreshold = 165;     // زاوية الصعود (الارتخاء)

        // State Machine to detect a full compression cycle
        if (currentElbowAngle <= compressionThreshold && this.cprState.lastDepthStatus === "up") {
            this.cprState.lastDepthStatus = "down";
        } 
        else if (currentElbowAngle >= releaseThreshold && this.cprState.lastDepthStatus === "down") {
            this.cprState.lastDepthStatus = "up";

            // Calculate time elapsed since the last completed compression
            if (this.cprState.lastCompressionTimestamp !== null) {
                const elapsedMs = currentTime - this.cprState.lastCompressionTimestamp;
                
                // Filter out accidental double triggers (intervals faster than 250ms)
                if (elapsedMs > 250) {
                    this.cprState.compressionTimes.push(elapsedMs);
                    if (this.cprState.compressionTimes.length > 5) {
                        this.cprState.compressionTimes.shift(); // Keep last 5 samples
                    }

                    // Compute rolling average to get current BPM
                    const avgInterval = this.cprState.compressionTimes.reduce((a, b) => a + b, 0) / this.cprState.compressionTimes.length;
                    const calculatedBpm = Math.round(60000 / avgInterval);

                    this.cprState.lastCompressionTimestamp = currentTime;

                    // Evaluate if BPM is within standard medical guidelines (100 - 120 BPM)
                    if (calculatedBpm >= 100 && calculatedBpm <= 120) {
                        return { bpm: calculatedBpm, feedback: "Perfect Rhythm!", isValid: true };
                    } else if (calculatedBpm < 100) {
                        return { bpm: calculatedBpm, feedback: "Push Faster!", isValid: false };
                    } else {
                        return { bpm: calculatedBpm, feedback: "Push Slower!", isValid: false };
                    }
                }
            }
            this.cprState.lastCompressionTimestamp = currentTime;
        }
        return null;
    }
}

const heuristicScorer = new HeuristicScorer();