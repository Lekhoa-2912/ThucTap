import { useRef, useCallback, useState, useEffect } from 'react'
import Webcam from 'react-webcam'
import * as faceapi from 'face-api.js'

export default function WebcamCapture({
    onCapture,
    onError,
    autoCapture = false,
    captureInterval = 33,
    maxCaptures = 150,
    showGuide = true,
    autoAttendance = false,
    attendanceDelay = 2000,
    onFaceDetected,
    isProcessing = false,
    feedback = null // Prop mới để nhận thông báo lỗi/trạng thái từ parent
}) {
    const webcamRef = useRef(null)
    const canvasRef = useRef(null)
    const [isCapturing, setIsCapturing] = useState(false)
    const [captureCount, setCaptureCount] = useState(0)
    const [currentPhase, setCurrentPhase] = useState(0)
    const [error, setError] = useState(null)

    // State cho chấm công tự động
    const [faceInFrame, setFaceInFrame] = useState(false)
    const [faceProgress, setFaceProgress] = useState(0)
    const [modelsLoaded, setModelsLoaded] = useState(false)
    const [loadingModels, setLoadingModels] = useState(true)
    const progressInterval = useRef(null)
    const faceDetectedTime = useRef(null)
    const detectionInterval = useRef(null)

    const phases = [
        { label: 'Nhìn thẳng', count: 30 },
        { label: 'Quay trái', count: 30 },
        { label: 'Quay phải', count: 30 },
        { label: 'Ngước lên', count: 30 },
        { label: 'Cúi xuống', count: 30 },
    ]

    const videoConstraints = {
        width: 640,
        height: 480,
        facingMode: 'user'
    }

    // Load face-api.js models
    useEffect(() => {
        const loadModels = async () => {
            try {
                setLoadingModels(true)
                // Load models từ CDN nếu không có local
                const MODEL_URL = '/models'

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
                ])

                setModelsLoaded(true)
                console.log('✅ Face detection models loaded successfully!')
            } catch (err) {
                console.error('Error loading face-api models:', err)
                try {
                    const CDN_URL = 'https://justadudewhohacks.github.io/face-api.js/models'
                    await faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL)
                    setModelsLoaded(true)
                    console.log('✅ Face detection models loaded from CDN!')
                } catch (cdnErr) {
                    console.error('Failed to load models from CDN:', cdnErr)
                    setError('Không thể tải model nhận diện khuôn mặt')
                }
            } finally {
                setLoadingModels(false)
            }
        }

        loadModels()
    }, [])

    const detectFace = useCallback(async () => {
        if (!webcamRef.current || !modelsLoaded) return false

        const video = webcamRef.current.video
        if (!video || video.readyState !== 4) return false

        try {
            const options = new faceapi.TinyFaceDetectorOptions({
                inputSize: 320,
                scoreThreshold: 0.5
            })

            const detections = await faceapi.detectAllFaces(video, options)

            if (detections.length > 0) {
                const face = detections[0]
                const box = face.box

                const videoCenterX = video.videoWidth / 2
                const videoCenterY = video.videoHeight / 2
                const faceCenterX = box.x + box.width / 2
                const faceCenterY = box.y + box.height / 2

                const minFaceSize = 80
                if (box.width < minFaceSize || box.height < minFaceSize) {
                    return false
                }

                const tolerance = 150
                const isInCenter =
                    Math.abs(faceCenterX - videoCenterX) < tolerance &&
                    Math.abs(faceCenterY - videoCenterY) < tolerance

                return isInCenter
            }

            return false
        } catch (err) {
            console.error('Face detection error:', err)
            return false
        }
    }, [modelsLoaded])

    // New optimized effect with debounce
    const consecutiveMisses = useRef(0)

    useEffect(() => {
        if (!autoAttendance || isProcessing || !modelsLoaded || feedback) {
            setFaceInFrame(false)
            setFaceProgress(0)
            consecutiveMisses.current = 0
            if (progressInterval.current) clearInterval(progressInterval.current)
            if (detectionInterval.current) clearInterval(detectionInterval.current)
            return
        }

        detectionInterval.current = setInterval(async () => {
            const hasFace = await detectFace()

            if (hasFace) {
                consecutiveMisses.current = 0 // Reset misses

                if (!faceInFrame) {
                    setFaceInFrame(true)
                    setFaceProgress(0)

                    const startTime = Date.now()
                    progressInterval.current = setInterval(() => {
                        // If we have missed too many frames, stop progress
                        if (consecutiveMisses.current > 2) { // Allow 2 misses (approx 400ms)
                            clearInterval(progressInterval.current)
                            setFaceInFrame(false)
                            setFaceProgress(0)
                            return
                        }

                        // Updated Delay: 1000ms (1s)
                        const TARGET_DELAY = 1000
                        const elapsed = Date.now() - startTime
                        const progress = Math.min((elapsed / TARGET_DELAY) * 100, 100)
                        setFaceProgress(progress)

                        if (progress >= 100) {
                            clearInterval(progressInterval.current)
                            if (webcamRef.current) {
                                const imageSrc = webcamRef.current.getScreenshot()
                                if (imageSrc && onCapture) {
                                    onCapture(imageSrc)
                                }
                            }
                        }
                    }, 50)
                }
            } else {
                consecutiveMisses.current += 1
                // We don't immediate reset here. The progressInterval checks consecutiveMisses.
                // But if faceInFrame is false, we do nothing.
                // If faceInFrame is true, the progressInterval loop will handle the reset if misses > 2.
            }
        }, 200)

        return () => {
            if (detectionInterval.current) clearInterval(detectionInterval.current)
            if (progressInterval.current) clearInterval(progressInterval.current)
        }
    }, [autoAttendance, isProcessing, modelsLoaded, detectFace, faceInFrame, onCapture, feedback])

    const capture = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot()
            if (imageSrc) {
                onCapture(imageSrc)
                return true
            }
        }
        return false
    }, [onCapture])

    useEffect(() => {
        let intervalId

        if (autoCapture && isCapturing && captureCount < maxCaptures) {
            intervalId = setInterval(() => {
                const success = capture()
                if (success) {
                    setCaptureCount(prev => {
                        const newCount = prev + 1

                        let total = 0
                        for (let i = 0; i < phases.length; i++) {
                            total += phases[i].count
                            if (newCount <= total) {
                                setCurrentPhase(i)
                                break
                            }
                        }

                        if (newCount >= maxCaptures) {
                            setIsCapturing(false)
                        }

                        return newCount
                    })
                }
            }, captureInterval)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [autoCapture, isCapturing, captureCount, maxCaptures, captureInterval, capture])

    const handleUserMediaError = (error) => {
        console.error('Webcam error:', error)
        setError('Không thể truy cập camera. Vui lòng cho phép quyền truy cập camera.')
        if (onError) onError(error)
    }

    const startCapture = () => {
        setCaptureCount(0)
        setCurrentPhase(0)
        setIsCapturing(true)
    }

    const stopCapture = () => {
        setIsCapturing(false)
    }

    const progress = (captureCount / maxCaptures) * 100

    return (
        <div className="relative">
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {error ? (
                <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-6 text-center">
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={() => {
                            setError(null)
                            window.location.reload()
                        }}
                        className="mt-4 btn-secondary"
                    >
                        Thử lại
                    </button>
                </div>
            ) : loadingModels ? (
                <div className="bg-slate-700/50 rounded-xl p-8 text-center">
                    <div className="spinner mx-auto mb-4"></div>
                    <p className="text-slate-300">Đang tải AI nhận diện khuôn mặt...</p>
                    <p className="text-slate-400 text-sm mt-2">Vui lòng đợi trong giây lát</p>
                </div>
            ) : (
                <>
                    <div className="camera-overlay rounded-xl overflow-hidden relative">
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            onUserMediaError={handleUserMediaError}
                            className="w-full"
                            mirrored={true}
                        />

                        {showGuide && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                {autoAttendance ? (
                                    <div className="relative">
                                        <svg
                                            className="transform -rotate-90"
                                            width="220"
                                            height="280"
                                            style={{
                                                filter: (faceInFrame && !feedback)
                                                    ? 'drop-shadow(0 0 20px rgba(34, 197, 94, 0.9))'
                                                    : feedback
                                                        ? 'drop-shadow(0 0 20px rgba(239, 68, 68, 0.5))'
                                                        : 'drop-shadow(0 0 10px rgba(59, 130, 246, 0.5))'
                                            }}
                                        >
                                            <ellipse
                                                cx="110"
                                                cy="140"
                                                rx="100"
                                                ry="130"
                                                fill="none"
                                                // Đổi màu viền dựa trên trạng thái
                                                stroke={
                                                    feedback
                                                        ? "rgba(239, 68, 68, 0.6)" // Red for error
                                                        : faceInFrame
                                                            ? "rgba(34, 197, 94, 0.5)" // Green for success
                                                            : "rgba(59, 130, 246, 0.5)" // Blue for idle
                                                }
                                                strokeWidth="8"
                                                strokeDasharray="12 6"
                                            />
                                            {faceInFrame && !feedback && (
                                                <ellipse
                                                    cx="110"
                                                    cy="140"
                                                    rx="100"
                                                    ry="130"
                                                    fill="none"
                                                    stroke="#22c55e"
                                                    strokeWidth="10"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${(faceProgress / 100) * 2 * Math.PI * 115} ${2 * Math.PI * 115}`}
                                                    style={{
                                                        transition: 'stroke-dasharray 0.1s linear',
                                                        filter: 'drop-shadow(0 0 12px rgba(34, 197, 94, 1))'
                                                    }}
                                                />
                                            )}
                                        </svg>

                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <div className="text-center px-4">
                                                {/* Hiển thị Feedback nếu có */}
                                                {feedback ? (
                                                    <div className="bg-red-900/90 px-5 py-3 rounded-xl shadow-2xl border border-red-500/50 animate-bounce-short">
                                                        <p className="text-red-200 text-lg font-bold flex items-center justify-center gap-2">
                                                            <span className="text-2xl">!</span> Lỗi nhận diện
                                                        </p>
                                                        <p className="text-white text-sm mt-1 font-medium">
                                                            {feedback.message}
                                                        </p>
                                                    </div>
                                                ) : isProcessing ? (
                                                    <div className="bg-slate-900/90 px-5 py-3 rounded-xl shadow-2xl border border-slate-600">
                                                        <div className="spinner mx-auto mb-2"></div>
                                                        <p className="text-white font-medium">Đang xác thực...</p>
                                                    </div>
                                                ) : faceInFrame ? (
                                                    <div className="bg-green-900/90 px-5 py-3 rounded-xl shadow-2xl border border-green-500">
                                                        <p className="text-green-300 text-lg font-bold flex items-center gap-2">
                                                            Đã nhận diện
                                                        </p>
                                                        <p className="text-white text-sm mt-1">
                                                            Giữ yên {Math.max(0, Math.ceil((100 - faceProgress) / 50))}s...
                                                        </p>
                                                        <div className="w-full bg-green-900/50 rounded-full h-2.5 mt-2">
                                                            <div
                                                                className="bg-green-400 h-2.5 rounded-full transition-all duration-100"
                                                                style={{ width: `${faceProgress}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="bg-slate-900/90 px-5 py-3 rounded-xl shadow-2xl border border-blue-500/50">
                                                        <p className="text-blue-300 text-lg font-medium flex items-center gap-2 justify-center">
                                                            Đưa mặt vào khung
                                                        </p>
                                                        <p className="text-slate-300 text-xs mt-1">
                                                            AI đang tìm kiếm khuôn mặt...
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-48 h-64 border-4 border-dashed border-blue-400/50 rounded-full" />
                                )}
                            </div>
                        )}
                    </div>

                    {autoCapture && (
                        <div className="mt-4">
                            <div className="bg-slate-700 rounded-full h-3 mb-4 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-full transition-all duration-300"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>

                            {isCapturing && (
                                <div className="text-center mb-4">
                                    <p className="text-4xl mb-2">{phases[currentPhase]?.icon}</p>
                                    <p className="text-lg font-medium">{phases[currentPhase]?.label}</p>
                                    <p className="text-slate-400 text-sm">
                                        Ảnh: {captureCount} / {maxCaptures}
                                    </p>
                                </div>
                            )}

                            <div className="flex gap-4 justify-center">
                                {!isCapturing ? (
                                    <button
                                        onClick={startCapture}
                                        className="btn-primary"
                                        disabled={captureCount >= maxCaptures}
                                    >
                                        {captureCount > 0 ? 'Tiếp tục chụp' : 'Bắt đầu chụp'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={stopCapture}
                                        className="btn-danger"
                                    >
                                        Dừng lại
                                    </button>
                                )}
                            </div>

                            {captureCount >= maxCaptures && (
                                <div className="mt-4 bg-green-500/20 border border-green-500/30 rounded-xl p-4 text-center">
                                    <p className="text-green-400 font-medium">
                                        Đã chụp đủ {maxCaptures} ảnh!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {!autoCapture && !autoAttendance && (
                        <div className="mt-4 flex justify-center">
                            <button
                                onClick={capture}
                                className="btn-primary"
                            >
                                Chụp ảnh
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
