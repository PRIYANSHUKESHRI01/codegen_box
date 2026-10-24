"""Extra rows that thicken the interests with the fewest questions. Same row shape as the branch files."""

EXTRA = {
    "ece": [
        ("technical", "medium", 150, ["signal_processing"],
         "What is a digital filter, and how would you choose between an FIR and an IIR filter?",
         "A filter shapes a signal's frequency content. FIR has finite impulse response, is always stable and can have exactly linear phase but needs more taps; IIR uses feedback, meets a specification with far fewer coefficients but can be unstable and has non-linear phase. Choose by phase requirement, computing budget and stability."),
        ("technical", "easy", 120, ["signal_processing"],
         "In practical terms, what is the Fourier transform used for?",
         "It shows which frequencies a signal contains, so you can analyse, filter and compress it; examples include spectrum analysers, equalisers, audio and image compression and communication systems. Mentions time versus frequency domain and that the FFT makes it fast."),
    ],
    "eee": [
        ("technical", "easy", 120, ["renewable_energy"],
         "What is the difference between on-grid, off-grid and hybrid solar systems?",
         "On-grid feeds the utility grid, cheapest, no battery, stops when the grid fails; off-grid has batteries and is independent of the grid; hybrid combines grid and battery for backup and self-consumption. Choice depends on grid reliability, cost and goals."),
        ("technical", "medium", 150, ["control_systems"],
         "Why do control systems sometimes oscillate, and how do you reduce it?",
         "Too much loop gain or delay makes feedback arrive out of phase and reinforce error, producing oscillation or instability. Reduce gain, add damping (derivative action or lead compensation), reduce delays or filter noise, and check gain and phase margins."),
    ],
    "mech": [
        ("technical", "medium", 120, ["robotics"],
         "What sensors would you use for a mobile robot to avoid obstacles, and why?",
         "Ultrasonic, infrared or LiDAR for distance, cameras for rich perception, bumpers as backup, plus encoders and an IMU for motion. Discuss range, accuracy, cost, lighting and surfaces, and combining sensors for reliability."),
        ("technical", "hard", 150, ["robotics"],
         "In simple terms, what is the difference between forward and inverse kinematics for a robot arm?",
         "Forward kinematics calculates the end-effector position from the joint angles - a direct calculation. Inverse kinematics finds the joint angles needed to reach a desired position - often several solutions, or none, and harder to compute. Needed for planning motion."),
    ],
    "civil": [
        ("technical", "medium", 150, ["environmental", "construction_management"],
         "How would you reduce the environmental impact of a construction site?",
         "Control dust and noise, manage runoff and sediment, store and dispose of waste properly, reduce and recycle materials, protect trees and water, choose lower-carbon materials, and plan to reduce transport and idle machinery. Compliance and monitoring."),
    ],
}
