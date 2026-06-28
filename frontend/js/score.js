/**
 * SkillMentor - Unified Heuristic Scoring Engine
 * كل منطق التقييم هنا — session.js يستدعي فقط
 */
class HeuristicScorer {

    constructor() {
        this.violationCounters = {};
        this.cprState = {
            lastDepthStatus:          "up",
            compressionTimes:         [],
            lastCompressionTimestamp: null
        };
    }

    // ─────────────────────────────────────────────────────────
    // صفّر كل الذاكرة عند بداية جلسة جديدة
    // ─────────────────────────────────────────────────────────
    reset() {
        this.violationCounters = {};
        this.cprState = {
            lastDepthStatus:          "up",
            compressionTimes:         [],
            lastCompressionTimestamp: null
        };
    }

    // ─────────────────────────────────────────────────────────
    // ① التقييم العام — كل المهارات
    // يقارن signalValue بـ perfect_min/max من Supabase
    // ─────────────────────────────────────────────────────────
    evaluateDimension(dimension, signalValue) {
        if (dimension.perfect_min === null || dimension.perfect_max === null) {
            return { isValid: true, feedback: dimension.good_feedback, shouldPenalize: false };
        }

        const isValid = signalValue >= dimension.perfect_min
                     && signalValue <= dimension.perfect_max;

        if (!isValid) {
            if (!this.violationCounters[dimension.id]) {
                this.violationCounters[dimension.id] = 0;
            }
            this.violationCounters[dimension.id]++;
            const shouldPenalize = this.violationCounters[dimension.id] % 15 === 0;
            return { isValid: false, feedback: dimension.bad_feedback, shouldPenalize };
        }

        this.violationCounters[dimension.id] = 0;
        return { isValid: true, feedback: dimension.good_feedback, shouldPenalize: false };
    }

    // ─────────────────────────────────────────────────────────
    // ② CPR — دالة موحدة تتعامل مع كل معايير الإنعاش
    // ─────────────────────────────────────────────────────────
    evaluateCpr(dimension, signalValue, wristYMax, wristYMin) {

        // عمق الضغط — amplitude detection
        if (dimension.pose_signal === "wrist_center_y") {
            const amplitude = wristYMax - wristYMin;
            const threshold = dimension.perfect_max; // من Supabase
            const isValid   = amplitude >= threshold;
            return {
                type:     "depth",
                isValid,
                feedback: isValid ? dimension.good_feedback : dimension.bad_feedback
            };
        }

        // إيقاع الضغط — state machine + تقييم الاستقامة
        if (dimension.pose_signal === "elbow_angle") {
            const rhythm  = this._cprRhythm(signalValue);
            const spatial = this.evaluateDimension(dimension, signalValue);
            return {
                type:     "rhythm",
                rhythm,                      // BPM object أو null
                isValid:  spatial.isValid,
                feedback: spatial.feedback
            };
        }

        // باقي معايير CPR — wrist_center_x و arm_angle
        return {
            type: "spatial",
            ...this.evaluateDimension(dimension, signalValue)
        };
    }

    // ─────────────────────────────────────────────────────────
    // State machine داخلية للـ CPR rhythm
    // ─────────────────────────────────────────────────────────
    _cprRhythm(elbowAngle) {
        const now                  = performance.now();
        const compressionThreshold = 130;
        const releaseThreshold     = 165;

        if (elbowAngle <= compressionThreshold && this.cprState.lastDepthStatus === "up") {
            this.cprState.lastDepthStatus = "down";

        } else if (elbowAngle >= releaseThreshold && this.cprState.lastDepthStatus === "down") {
            this.cprState.lastDepthStatus = "up";

            if (this.cprState.lastCompressionTimestamp !== null) {
                const elapsed = now - this.cprState.lastCompressionTimestamp;

                if (elapsed > 250) {
                    this.cprState.compressionTimes.push(elapsed);
                    if (this.cprState.compressionTimes.length > 5) {
                        this.cprState.compressionTimes.shift();
                    }

                    const avg = this.cprState.compressionTimes.reduce((a, b) => a + b, 0)
                              / this.cprState.compressionTimes.length;
                    const bpm = Math.round(60000 / avg);

                    this.cprState.lastCompressionTimestamp = now;

                    if (bpm >= 100 && bpm <= 120) {
                        return { bpm, feedback: "Perfect rhythm!",  isValid: true  };
                    } else if (bpm < 100) {
                        return { bpm, feedback: "Push faster!",     isValid: false };
                    } else {
                        return { bpm, feedback: "Push slower!",     isValid: false };
                    }
                }
            }
            this.cprState.lastCompressionTimestamp = now;
        }
        return null;
    }
}

const heuristicScorer = new HeuristicScorer();