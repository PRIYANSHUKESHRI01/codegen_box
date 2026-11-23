"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/lib/toast";
import {
  Bot,
  Sparkles,
  X,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  Send,
  CheckCircle2,
  ExternalLink,
  AlertTriangle,
  Briefcase,
  ShieldCheck,
  Mic,
  CreditCard,
  Brain,
  ChevronRight,
  Headphones,
  Mail,
  Loader2,
  CornerDownRight,
  HelpCircle,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * AptBot brand lockup styled identically to the AptRun master logo:
 * - "apt" in AptRun blue (#3E9DEF)
 * - "Bot" in AptRun yellow (#FFD352)
 * - font-extrabold tracking-tight typography matching public/brand/aptrun-wordmark.png
 */
export function AptBotBrand({ className }: { className?: string }) {
  return (
    <span aria-label="aptBot" className={cn("font-extrabold tracking-tight inline-flex items-baseline select-none", className)}>
      <span className="text-[#3E9DEF]" aria-hidden="true">apt</span>
      <span className="text-[#FFD352]" aria-hidden="true">Bot</span>
      <span className="sr-only">aptBot</span>
    </span>
  );
}

export interface AptBotFaqItem {
  id?: number;
  slug: string;
  question: string;
  answer: string;
  action_label?: string | null;
  action_url?: string | null;
  related_slugs?: string[];
}

export interface AptBotCategory {
  key: string;
  label: string;
  icon: string;
  faqs: AptBotFaqItem[];
}

// Built-in instant knowledge base (0ms latency, works offline or while API loads)
const DEFAULT_CATEGORIES: AptBotCategory[] = [
  {
    key: "about_aptrun",
    label: "About AptRun",
    icon: "Brain",
    faqs: [
      {
        slug: "what-is-aptrun",
        question: "What is AptRun and how does it help me get placed?",
        answer:
          "AptRun is India's leading campus placement and engineering readiness sandbox. It brings together everything you need to crack tier-1 tech placements:\n\n• **Practice Arena**: Hundreds of handpicked DSA coding problems organized by core pattern and company tags.\n• **Learning Centre & Articles**: In-depth theoretical articles and system design patterns from first principles.\n• **Mock AI Interviews**: Interactive voice interviews with real-time speech transcription and industry rubric feedback.\n• **Vault AI Interview**: High-stakes AI interview simulation that unlocks candidate verification for hiring partners.\n• **Performance Report**: Real-time evaluation of your coding speed, accuracy, and interview communication.",
        action_label: "Explore Practice Arena",
        action_url: "/dashboard/practice",
        related_slugs: ["what-is-readiness-score", "what-is-project-lab"],
      },
      {
        slug: "what-is-readiness-score",
        question: "What is the AptRun Readiness Score?",
        answer:
          "The **Readiness Score (0–100%)** is your comprehensive hiring readiness benchmark evaluated across 4 core vectors:\n\n1. **Problem Solving (DSA)**: Algorithmic correctness, time/space complexity, and consistency.\n2. **Technical Breadth**: Core CS fundamentals, operating systems, DBMS, and system design.\n3. **Soft Skills & Aptitude**: Speed and accuracy in quantitative, logical, and situational questions.\n4. **Interview Articulation**: Voice-clarity, structure, and technical depth in AI interviews.\n\nA Readiness Score of **60% or above** unlocks direct recruiter recommendations on Mellow Vault.",
        action_label: "View Performance Report",
        action_url: "/dashboard/reports",
        related_slugs: ["what-is-aptrun", "vault-ai-60-percent-qualification"],
      },
      {
        slug: "what-is-project-lab",
        question: "What is Project Lab and how does it work?",
        answer:
          "Project Lab gives you end-to-end, production-grade software development projects designed to make your resume stand out to technical interviewers.\n\nEach project includes:\n• Architectural blueprints and database schema designs.\n• Milestone-by-milestone guided tasks with live code editors.\n• System design explanations and real-world deployment considerations.",
        action_label: "Open Project Lab",
        action_url: "/dashboard/projects",
        related_slugs: ["what-is-aptrun"],
      },
    ],
  },
  {
    key: "vault_ai",
    label: "Vault AI Interview",
    icon: "ShieldCheck",
    faqs: [
      {
        slug: "what-is-vault-ai-interview",
        question: "What is the Vault AI Interview?",
        answer:
          "The **Vault AI Interview** is AptRun's flagship candidate qualification interview. Unlike practice mock rounds, Vault AI tests simulate live high-stakes company hiring interviews:\n\n• **Structure**: Series containing progressive sets testing technical fundamentals, architecture, and live problem solving.\n• **Proctoring**: Fullscreen locking, webcam/mic verification, and tab-switch monitoring to guarantee honest performance.\n• **Evaluation**: Multidimensional AI scoring analyzing technical accuracy, response depth, and communication delivery.",
        action_label: "Go to Vault AI Interview",
        action_url: "/dashboard/vault-interviews",
        related_slugs: ["vault-ai-60-percent-qualification", "vault-ai-retakes"],
      },
      {
        slug: "vault-ai-60-percent-qualification",
        question: "Why is 60%+ the qualification score in Vault AI Interview?",
        answer:
          "Scoring **60% or higher** in the Vault AI Interview is the benchmark required by our corporate hiring partners on Mellow Vault:\n\n• **Verified for Hiring Badge**: Reaching 60%+ unlocks the verified badge on your profile.\n• **Recruiter Visibility**: Verified profiles are directly indexed for top tech employers and recruiting teams seeking pre-vetted engineers.\n• **Fast-Tracked Shortlisting**: Companies skip preliminary screening rounds and invite verified candidates directly to final technical/HR rounds.",
        action_label: "Start Vault AI Interview",
        action_url: "/dashboard/vault-interviews",
        related_slugs: ["direct-candidates-mellow-vault", "vault-ai-retakes"],
      },
      {
        slug: "vault-ai-retakes",
        question: "Can I retake the Vault AI Interview if I scored below 60%?",
        answer:
          "Yes! If you scored below 60%, you can review your AI feedback rubric, practice weak topics in the Mock AI Interview or Practice Arena, and reattempt:\n\n• Your highest achieved score is preserved on your profile.\n• We recommend practicing in Mock AI Interview before re-attempting your next Vault set.",
        action_label: "Practice Mock Interviews",
        action_url: "/dashboard/interviews",
        related_slugs: ["what-is-vault-ai-interview", "vault-ai-60-percent-qualification"],
      },
    ],
  },
  {
    key: "placement_drives",
    label: "Placement Drives & Mellow Vault",
    icon: "Briefcase",
    faqs: [
      {
        slug: "direct-candidates-campus-drives-explained",
        question: "Why do direct AptRun candidates not see campus drives on Upcoming Drives?",
        answer:
          "Campus placement drives on the **Upcoming Drives** page are exclusive drives opened directly by partner college placement cells (TPOs) for their enrolled students.\n\nIf you are an independent/direct AptRun member:\n• You get hired off-campus through **Mellow Vault**!\n• Complete the **Vault AI Interview** with **60%+** to be verified for hiring.\n• Once verified, our network of hiring partners accesses your profile directly on Mellow Vault.",
        action_label: "Learn About Mellow Vault",
        action_url: "/dashboard/vault",
        related_slugs: ["direct-candidates-mellow-vault", "future-hiring-on-aptrun"],
      },
      {
        slug: "direct-candidates-mellow-vault",
        question: "How do independent users get hired through Mellow Vault?",
        answer:
          "Mellow Vault is the off-campus hiring partner network for AptRun members:\n\n1. **Profile Setup**: Your AptRun profile connects directly to Mellow Vault.\n2. **Verification Milestone**: Score **60% or higher** in the **Vault AI Interview**.\n3. **Employer Outreach**: Hiring partners browse verified profiles, review interview scores, and extend interview invites directly.",
        action_label: "Open Mellow Vault",
        action_url: "/dashboard/vault",
        related_slugs: ["vault-ai-60-percent-qualification", "future-hiring-on-aptrun"],
      },
      {
        slug: "future-hiring-on-aptrun",
        question: "Will hiring partners also recruit directly on AptRun in the future?",
        answer:
          "Yes! In the near future, hiring partners and tech recruiters will also host recruitment drives and hackathons directly on AptRun!\n\nTo make sure you are prioritized when direct AptRun drives open:\n• Keep solving daily DSA problems in the Practice Arena.\n• Achieve 60%+ in Vault AI Interview sets.\n• Keep your Readiness Score above 70%.",
        action_label: "Practice on AptRun",
        action_url: "/dashboard/practice",
        related_slugs: ["direct-candidates-mellow-vault", "what-is-readiness-score"],
      },
    ],
  },
  {
    key: "mock_interviews",
    label: "Mock AI Voice Interviews",
    icon: "Mic",
    faqs: [
      {
        slug: "how-mock-interviews-work",
        question: "How do Mock AI Voice Interviews work?",
        answer:
          "Mock AI Interviews replicate real technical screening and HR rounds using conversational AI:\n\n• Choose your domain (Backend, Frontend, Full Stack, Data Science, etc.) and tech stack (Laravel, React, Node.js, Python, Java, etc.).\n• The AI interviewer speaks questions aloud.\n• Speak your answer naturally into your microphone — speech recognition transcribes your words in real time.\n• Upon completion, you receive an immediate breakdown of concept accuracy, technical keywords, and clarity.",
        action_label: "Start a Mock Interview",
        action_url: "/dashboard/interviews",
        related_slugs: ["mock-interview-supported-stacks", "mic-troubleshooting"],
      },
      {
        slug: "mock-interview-supported-stacks",
        question: "What domains and tech stacks can I practice?",
        answer:
          "AptRun supports 25+ industry tech stacks across all primary engineering disciplines:\n\n• **Full Stack & Backend**: Laravel, Node.js/Express, Python/Django, Java Spring Boot, Go, .NET, Ruby on Rails.\n• **Frontend**: React, Next.js, Vue.js, Angular, TypeScript.\n• **Data & AI**: Python Data Science, Machine Learning, SQL, Big Data.\n• **Mobile & Systems**: Flutter, Android Kotlin, iOS Swift, C++, DevOps & Cloud.",
        action_label: "Explore Interview Tracks",
        action_url: "/dashboard/interviews/practice",
        related_slugs: ["how-mock-interviews-work"],
      },
    ],
  },
  {
    key: "soft_skills",
    label: "Soft Skills & Tests",
    icon: "CheckCircle2",
    faqs: [
      {
        slug: "how-soft-skills-tests-work",
        question: "How are Soft Skills tests structured on AptRun?",
        answer:
          "AptRun provides 45 comprehensive test sets mimicking campus aptitude assessments:\n\n• **4 Key Categories**: Quantitative Aptitude, Logical Reasoning, Verbal English, and Situational Judgement.\n• **Zero Negative Marking**: All multiple-choice questions have equal weight.\n• **Real-Time Autosave**: Your selections are immediately saved to the server as you click options.\n• **Fullscreen & Anti-Copy**: Continuous fullscreen and anti-cheating protection are active throughout the test.",
        action_label: "Take a Soft Skills Test",
        action_url: "/dashboard/soft-skills",
        related_slugs: ["fullscreen-strikes-explained"],
      },
    ],
  },
  {
    key: "troubleshooting",
    label: "Errors & Troubleshooting",
    icon: "AlertTriangle",
    faqs: [
      {
        slug: "fullscreen-strikes-explained",
        question: "I got a strike warning for exiting fullscreen. How does this work?",
        answer:
          "Proctored assessments (Contests, Vault AI, Soft Skills) require continuous fullscreen mode:\n\n• Pressing Esc, switching browser tabs, or opening external apps triggers a **Strike Warning**.\n• You receive **2 warnings**. A **3rd strike** terminates and auto-submits your attempt.\n• If you accidentally exited fullscreen, click the **'Resume Fullscreen'** button immediately to return to the exam without further penalty.",
        action_label: "Read Proctoring Guidelines",
        action_url: "/dashboard/soft-skills",
        related_slugs: ["mic-troubleshooting"],
      },
      {
        slug: "mic-troubleshooting",
        question: "Microphone or webcam not working in interview.",
        answer:
          "If your microphone or camera is not detected:\n\n1. **Browser Permission**: Click the **Lock icon** on the left of your browser address bar and verify that Camera and Microphone permissions are set to **Allow**.\n2. **Hardware Check**: Ensure your headset/mic is firmly plugged in and not muted via physical switch.\n3. **App Conflict**: Close other apps that might be using the camera (Zoom, Google Meet, Teams, Discord).\n4. **Refresh**: Reload the page to initialize the device test preview.",
        action_label: "Test in Mock Interview",
        action_url: "/dashboard/interviews",
        related_slugs: ["fullscreen-strikes-explained"],
      },
      {
        slug: "test-timer-expired",
        question: "My test timer ran out before I clicked submit.",
        answer:
          "Don't panic! AptRun's server continuously auto-saves every answer you select.\n\nIf your timer reaches 0:00:\n• The system automatically submits all saved responses to the scoring engine.\n• No answers are lost, and your score will be generated accurately based on what was saved.",
        action_label: "Check Your Results",
        action_url: "/dashboard/soft-skills",
        related_slugs: ["fullscreen-strikes-explained"],
      },
    ],
  },
  {
    key: "billing",
    label: "Plans & Account Settings",
    icon: "CreditCard",
    faqs: [
      {
        slug: "expert-plan-features",
        question: "What is included in the AptRun Expert Plan?",
        answer:
          "The **AptRun Expert Plan** unlocks the complete career launchpad:\n\n• Unlimited DSA problem submissions in Practice Arena.\n• Full access to Project Lab and guided production projects.\n• Unlimited Mock AI Voice Interviews across all 25+ stacks.\n• Vault AI Interview eligibility and Mellow Vault candidate verification.\n• Comprehensive performance analytics and percentile benchmarking.",
        action_label: "View Subscription Plans",
        action_url: "/dashboard/billing",
        related_slugs: ["what-is-aptrun", "direct-candidates-mellow-vault"],
      },
      {
        slug: "update-profile-settings",
        question: "How do I update my profile, roll number, or graduation year?",
        answer:
          "You can update your personal information, department, roll number, and graduation year directly under your profile settings:\n\n• Go to **Dashboard > Settings** (or click your avatar at the bottom of the sidebar).\n• Update your academic year, graduation year (from 2018 onwards), and department.\n• Save changes to ensure placement eligibility criteria reflect your accurate profile.",
        action_label: "Go to Settings",
        action_url: "/dashboard/settings",
        related_slugs: ["expert-plan-features"],
      },
    ],
  },
];

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text?: string;
  faq?: AptBotFaqItem;
  timestamp: string;
  showFeedback?: boolean;
  feedbackGiven?: "helpful" | "unhelpful";
}

const CATEGORY_COLORS: Record<
  string,
  {
    iconColor: string;
    activeBg: string;
    borderHover: string;
    bgHover: string;
  }
> = {
  about_aptrun: {
    iconColor: "text-indigo-600 dark:text-indigo-400",
    activeBg: "bg-indigo-600 text-white shadow-indigo-500/25",
    borderHover: "hover:border-indigo-400 dark:hover:border-indigo-600",
    bgHover: "hover:bg-indigo-50/70 dark:hover:bg-indigo-950/30",
  },
  vault_ai: {
    iconColor: "text-violet-600 dark:text-violet-400",
    activeBg: "bg-violet-600 text-white shadow-violet-500/25",
    borderHover: "hover:border-violet-400 dark:hover:border-violet-600",
    bgHover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/30",
  },
  placement_drives: {
    iconColor: "text-emerald-600 dark:text-emerald-400",
    activeBg: "bg-emerald-600 text-white shadow-emerald-500/25",
    borderHover: "hover:border-emerald-400 dark:hover:border-emerald-600",
    bgHover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30",
  },
  mock_interviews: {
    iconColor: "text-sky-600 dark:text-sky-400",
    activeBg: "bg-sky-600 text-white shadow-sky-500/25",
    borderHover: "hover:border-sky-400 dark:hover:border-sky-600",
    bgHover: "hover:bg-sky-50/70 dark:hover:bg-sky-950/30",
  },
  soft_skills: {
    iconColor: "text-teal-600 dark:text-teal-400",
    activeBg: "bg-teal-600 text-white shadow-teal-500/25",
    borderHover: "hover:border-teal-400 dark:hover:border-teal-600",
    bgHover: "hover:bg-teal-50/70 dark:hover:bg-teal-950/30",
  },
  troubleshooting: {
    iconColor: "text-amber-600 dark:text-amber-400",
    activeBg: "bg-amber-600 text-white shadow-amber-500/25",
    borderHover: "hover:border-amber-400 dark:hover:border-amber-600",
    bgHover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/30",
  },
  billing: {
    iconColor: "text-purple-600 dark:text-purple-400",
    activeBg: "bg-purple-600 text-white shadow-purple-500/25",
    borderHover: "hover:border-purple-400 dark:hover:border-purple-600",
    bgHover: "hover:bg-purple-50/70 dark:hover:bg-purple-950/30",
  },
};

function renderCategoryIcon(iconName: string, customColor?: string) {
  const iconProps = { className: `w-3.5 h-3.5 shrink-0 ${customColor || ""}` };
  switch (iconName) {
    case "Brain":
      return <Brain {...iconProps} />;
    case "ShieldCheck":
      return <ShieldCheck {...iconProps} />;
    case "Briefcase":
      return <Briefcase {...iconProps} />;
    case "Mic":
      return <Mic {...iconProps} />;
    case "CheckCircle2":
      return <CheckCircle2 {...iconProps} />;
    case "AlertTriangle":
      return <AlertTriangle {...iconProps} />;
    case "CreditCard":
      return <CreditCard {...iconProps} />;
    default:
      return <HelpCircle {...iconProps} />;
  }
}

export function AptBotWidget() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<AptBotCategory[]>(DEFAULT_CATEGORIES);
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isEscalating, setIsEscalating] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [ticketSuccess, setTicketSuccess] = useState<{ ticketNumber: string; message: string } | null>(null);
  const [ticketError, setTicketError] = useState<string | null>(null);

  // Escalation form fields
  const [formMessage, setFormMessage] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const questionsDrawerRef = useRef<HTMLDivElement>(null);

  // Fetch live FAQs from API, keeping fallback intact
  useEffect(() => {
    let isMounted = true;
    api
      .get<{ categories: AptBotCategory[] }>("/aptbot/faqs")
      .then((res) => {
        if (isMounted && res?.categories && res.categories.length > 0) {
          setCategories(res.categories);
        }
      })
      .catch(() => {
        // Quiet fallback to DEFAULT_CATEGORIES
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize bot greeting when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingText = user?.name
        ? `Hi ${user.name.split(" ")[0]}! 👋 I'm **aptBot**, AptRun's intelligent placement assistant.`
        : `Hi there! 👋 I'm **aptBot**, AptRun's intelligent placement assistant.`;

      setMessages([
        {
          id: "welcome-1",
          sender: "bot",
          text: `${greetingText}\n\nSelect a topic below to explore instant answers, interview tips, or connect directly with our placement team.`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [isOpen, messages.length, user]);

  // If in an active proctored assessment session, do NOT show the chatbot
  const isProctoredSession = pathname?.includes("/session") || pathname?.includes("/exam/");
  if (isProctoredSession) {
    return null;
  }

  // Find all FAQs in a flat map for quick related lookups
  const allFaqsMap = React.useMemo(() => {
    const map = new Map<string, AptBotFaqItem>();
    categories.forEach((cat) => {
      cat.faqs.forEach((faq) => {
        map.set(faq.slug, faq);
      });
    });
    return map;
  }, [categories]);

  /**
   * Select a Topic:
   * When user clicks "About AptRun" or any topic, expand the questions drawer
   * and smoothly scroll the container down so the questions are FULLY visible for reading!
   */
  const handleSelectCategory = (catKey: string) => {
    if (selectedCategoryKey === catKey) {
      setSelectedCategoryKey(null);
    } else {
      setSelectedCategoryKey(catKey);
      setIsEscalating(false);

      // Smoothly scroll down so the questions drawer is in full view
      setTimeout(() => {
        const drawerEl = document.getElementById("aptbot-questions-drawer");
        if (drawerEl) {
          drawerEl.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 70);
    }
  };

  /**
   * Select an FAQ:
   * 1. Add user query and AptBot answer to chat stream.
   * 2. Close the topic drawer so the screen is clean and not cluttered.
   * 3. Smoothly scroll so the new question and the start of the answer are positioned at the top of the reading area.
   */
  const handleSelectFaq = (faq: AptBotFaqItem) => {
    const userMsgId = "msg-user-" + Date.now();
    const botMsgId = "msg-bot-" + Date.now();

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: faq.question,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: "bot",
      faq: faq,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      showFeedback: true,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setIsEscalating(false);
    setSelectedCategoryKey(null); // Close questions drawer to focus on reading

    // Scroll so the new question and the beginning of the answer are aligned for reading
    setTimeout(() => {
      const userEl = document.getElementById(userMsgId);
      if (userEl) {
        userEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 90);
  };

  const handleFeedback = (messageId: string, rating: "helpful" | "unhelpful") => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId) {
          return { ...msg, feedbackGiven: rating };
        }
        return msg;
      })
    );

    if (rating === "unhelpful") {
      if (!user) {
        toast.info("Please sign in to write a query to support.");
        setIsOpen(false);
        router.push("/login?redirect=" + encodeURIComponent(pathname || "/dashboard"));
        return;
      }

      setIsEscalating(true);
      const studentFirstName = user.name ? user.name.split(" ")[0] : "there";
      const promptEscalationMsg: ChatMessage = {
        id: "esc-prompt-" + Date.now(),
        sender: "bot",
        text: `I'm sorry that didn't fully answer your question, ${studentFirstName}. Feel free to write your query in the box below — our team will receive it with your student details and assist you directly.`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, promptEscalationMsg]);

      setTimeout(() => {
        const formEl = document.getElementById("aptbot-escalation-form");
        if (formEl) {
          formEl.scrollIntoView({ behavior: "smooth", block: "end" });
        }
      }, 100);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "reset-" + Date.now(),
        sender: "bot",
        text: "Chat refreshed! Please select a topic below to get instant answers:",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setSelectedCategoryKey(null);
    setIsEscalating(false);
    setTicketSuccess(null);
    setTicketError(null);
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const userQuery = formMessage.trim();
    if (!userQuery || userQuery.length < 5) {
      setTicketError("Please enter your message before sending.");
      return;
    }

    setIsSubmittingTicket(true);
    setTicketError(null);

    const userMsgId = "msg-user-q-" + Date.now();
    const botConfirmId = "msg-bot-c-" + Date.now();

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: userQuery,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const confirmationMsg: ChatMessage = {
      id: botConfirmId,
      sender: "bot",
      text: `✨ **Your query has been submitted!**\n\nThank you for reaching out. We have logged your request and our support team has been notified. One of our specialists will review your message and assist you shortly.\n\nIn the meantime, feel free to explore other topics above or continue practicing!`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    try {
      const payload = {
        name: user?.name || "AptRun Candidate",
        email: user?.email || "candidate@aptrun.com",
        message: userQuery,
        metadata: {
          path: pathname,
          platform: "AptBot Widget",
        },
      };

      await api.post<{
        success: boolean;
        ticket_number: string;
        message: string;
      }>("/aptbot/support-ticket", payload);

      setMessages((prev) => [...prev, userMsg, confirmationMsg]);
      setFormMessage("");
      setIsEscalating(false);

      setTimeout(() => {
        const el = document.getElementById(userMsgId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 90);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to submit your query. Please try again.";
      setTicketError(errorMsg);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const selectedCategory = categories.find((c) => c.key === selectedCategoryKey);

  return (
    <>
      {/* ── FLOATING LAUNCHER BUTTON ─────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5">
        {!isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(true)}
            className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-xs font-medium px-3.5 py-2 rounded-full shadow-lg shadow-indigo-950/10 border border-slate-200/90 dark:border-slate-800 cursor-pointer hover:border-indigo-400 dark:hover:border-indigo-600 transition-all select-none group"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-200">
              <span>Ask</span>
              <AptBotBrand className="text-xs" />
            </span>
          </motion.div>
        )}

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close AptBot" : "Open AptBot Instant Assistant"}
          className={`relative p-3.5 rounded-full shadow-xl transition-all duration-300 flex items-center justify-center focus:outline-none focus:ring-4 focus:ring-indigo-500/30 ${
            isOpen
              ? "bg-slate-800 text-slate-200 rotate-90 border border-slate-700 shadow-slate-900/30"
              : "bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-indigo-500/25 ring-2 ring-white/60 dark:ring-slate-900/60"
          }`}
        >
          {isOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <>
              <Bot className="w-5 h-5" />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
            </>
          )}
        </motion.button>
      </div>

      {/* ── EXPANDED CHAT PANEL ───────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[430px] max-h-[82vh] h-[650px] bg-white dark:bg-[#0E1117] border border-slate-200/90 dark:border-slate-800 rounded-2xl shadow-2xl shadow-indigo-950/20 flex flex-col overflow-hidden text-slate-800 dark:text-slate-100 antialiased font-sans"
          >
            {/* ── Sleek Modern Header ── */}
            <div className="px-4 py-3 bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600 text-white flex items-center justify-between shrink-0 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="relative p-2 rounded-xl bg-white/15 backdrop-blur border border-white/20 text-white shadow-xs">
                  <Bot className="w-4 h-4" />
                  <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-400 border-2 border-indigo-600 rounded-full" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-bold tracking-tight text-sm">
                    <AptBotBrand className="text-sm text-white" />
                    <span className="px-1.5 py-0.2 text-[9px] uppercase font-semibold bg-white/20 text-indigo-100 rounded tracking-wider">
                      Instant AI
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-100/90 font-normal flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Online • 0ms Placement Assistant
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={handleResetChat}
                  title="Reset Conversation"
                  aria-label="Reset Conversation"
                  className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  title="Close AptBot"
                  aria-label="Close AptBot"
                  className="p-1.5 rounded-lg text-indigo-100 hover:text-white hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ── Messages & Interactive Body ── */}
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5 scroll-smooth bg-[#F8FAFC] dark:bg-[#0B0E14]"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  id={msg.id}
                  className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[90%] text-xs leading-relaxed px-4 py-3 rounded-2xl shadow-xs transition-all ${
                      msg.sender === "user"
                        ? "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-br-xs shadow-indigo-600/10"
                        : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-bl-xs border border-slate-200/90 dark:border-slate-800 shadow-slate-200/50"
                    }`}
                  >
                    {/* User Text or Bot Simple Text */}
                    {msg.text && (
                      <div className="whitespace-pre-line font-normal space-y-1.5">
                        {msg.text.split("\n").map((line, i) => {
                          const parts = line.split(/(\*\*.*?\*\*)/g);
                          return (
                            <p key={i}>
                              {parts.map((p, pi) => {
                                if (p.startsWith("**") && p.endsWith("**")) {
                                  const inner = p.slice(2, -2);
                                  if (inner.toLowerCase() === "aptbot") {
                                    return <AptBotBrand key={pi} className="text-xs" />;
                                  }
                                  return (
                                    <strong key={pi} className="font-semibold text-slate-900 dark:text-white">
                                      {inner}
                                    </strong>
                                  );
                                }
                                if (p.startsWith("`") && p.endsWith("`")) {
                                  return (
                                    <code key={pi} className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] border border-indigo-200/50 dark:border-indigo-800/50">
                                      {p.slice(1, -1)}
                                    </code>
                                  );
                                }
                                return p;
                              })}
                            </p>
                          );
                        })}
                      </div>
                    )}

                    {/* Bot Structured FAQ Item with Rich Solution Card */}
                    {msg.faq && (
                      <div className="space-y-3">
                        {/* Title Bar */}
                        <div className="font-semibold text-indigo-600 dark:text-indigo-400 text-xs border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>{msg.faq.question}</span>
                        </div>

                        {/* Answer Details with Clean Readable Typography */}
                        <div className="whitespace-pre-line text-xs font-normal text-slate-700 dark:text-slate-300 space-y-1.5 leading-relaxed">
                          {msg.faq.answer.split("\n").map((line, i) => {
                            const isBullet = line.startsWith("•");
                            const cleanLine = isBullet ? line.slice(1).trim() : line;
                            const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

                            if (isBullet) {
                              return (
                                <div key={i} className="flex items-start gap-2 pl-0.5 my-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />
                                  <div className="flex-1">
                                    {parts.map((p, pi) => {
                                      if (p.startsWith("**") && p.endsWith("**")) {
                                        return (
                                          <strong key={pi} className="font-semibold text-slate-900 dark:text-white">
                                            {p.slice(2, -2)}
                                          </strong>
                                        );
                                      }
                                      return p;
                                    })}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <p key={i}>
                                {parts.map((p, pi) => {
                                  if (p.startsWith("**") && p.endsWith("**")) {
                                    return (
                                      <strong key={pi} className="font-semibold text-slate-900 dark:text-white">
                                        {p.slice(2, -2)}
                                      </strong>
                                    );
                                  }
                                  return p;
                                })}
                              </p>
                            );
                          })}
                        </div>

                        {/* Deep link button if action is present */}
                        {msg.faq.action_url && msg.faq.action_label && (
                          <div className="pt-1">
                            <Link
                              href={msg.faq.action_url}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition-all shadow-xs group"
                            >
                              <span>{msg.faq.action_label}</span>
                              <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                            </Link>
                          </div>
                        )}

                        {/* Related Questions Chips: Candidate scrolls down to see these */}
                        {msg.faq.related_slugs && msg.faq.related_slugs.length > 0 && (
                          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 mb-1.5 flex items-center gap-1">
                              <CornerDownRight className="w-3 h-3 text-indigo-500" />
                              <span>Related questions:</span>
                            </p>
                            <div className="flex flex-col gap-1.5">
                              {msg.faq.related_slugs.map((slug) => {
                                const relFaq = allFaqsMap.get(slug);
                                if (!relFaq) return null;
                                return (
                                  <button
                                    key={slug}
                                    onClick={() => handleSelectFaq(relFaq)}
                                    className="text-left text-[11px] text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/40 p-1.5 px-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700 transition-all flex items-center justify-between group"
                                  >
                                    <span className="truncate">{relFaq.question}</span>
                                    <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1 transition-transform group-hover:translate-x-0.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Feedback and Timestamp Row */}
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className="text-[10px] text-slate-400">{msg.timestamp}</span>

                    {/* Feedback Rating */}
                    {msg.showFeedback && !msg.feedbackGiven && (
                      <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 ml-2">
                        <span>Was this helpful?</span>
                        <button
                          onClick={() => handleFeedback(msg.id, "helpful")}
                          title="Helpful"
                          className="p-1 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded transition-colors"
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleFeedback(msg.id, "unhelpful")}
                          title="Need more help"
                          className="p-1 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded transition-colors"
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {msg.feedbackGiven === "helpful" && (
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5 ml-2">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Thank you!
                      </span>
                    )}

                    {msg.feedbackGiven === "unhelpful" && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 ml-2">
                        Connecting to support...
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* ── Topic / Category Selector: Modern Clean White Cards ── */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span>Browse Topics</span>
                  </p>
                  {selectedCategoryKey && (
                    <button
                      onClick={() => setSelectedCategoryKey(null)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                    >
                      Hide questions
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => {
                    const isSelected = selectedCategoryKey === cat.key;
                    const style = CATEGORY_COLORS[cat.key] || {
                      iconColor: "text-slate-600",
                      activeBg: "bg-indigo-600 text-white",
                      borderHover: "hover:border-indigo-300",
                      bgHover: "hover:bg-indigo-50/50",
                    };

                    return (
                      <button
                        key={cat.key}
                        onClick={() => handleSelectCategory(cat.key)}
                        className={`text-xs px-2.5 py-1.5 rounded-xl font-medium transition-all flex items-center gap-1.5 border shadow-2xs ${
                          isSelected
                            ? `${style.activeBg} border-transparent shadow-sm scale-102`
                            : `bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200/90 dark:border-slate-800 ${style.borderHover} ${style.bgHover}`
                        }`}
                      >
                        {renderCategoryIcon(cat.icon, isSelected ? "text-white" : style.iconColor)}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Questions in Selected Topic: Clean Elegant Card List ── */}
              {selectedCategory && (
                <motion.div
                  id="aptbot-questions-drawer"
                  ref={questionsDrawerRef}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 shadow-md space-y-2.5 my-2"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-900 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{selectedCategory.label} Questions</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 dark:bg-indigo-950/60 rounded text-indigo-700 dark:text-indigo-300 font-normal">
                        {selectedCategory.faqs.length} available
                      </span>
                    </span>
                    <button
                      onClick={() => setSelectedCategoryKey(null)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors font-normal"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {selectedCategory.faqs.map((faq) => (
                      <button
                        key={faq.slug}
                        onClick={() => handleSelectFaq(faq)}
                        className="w-full text-left text-xs p-2.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 hover:bg-indigo-50/70 dark:hover:bg-indigo-950/50 border border-slate-200/70 dark:border-slate-700/60 hover:border-indigo-400 dark:hover:border-indigo-600 text-slate-800 dark:text-slate-200 transition-all flex items-center justify-between gap-2.5 group shadow-2xs"
                      >
                        <span className="font-medium group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                          {faq.question}
                        </span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0 transition-transform group-hover:translate-x-1" />
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ── Escalation / Direct Query Form (Only message input) ── */}
              {isEscalating && (
                <motion.div
                  id="aptbot-escalation-form"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200/90 dark:border-indigo-900/60 shadow-md space-y-2.5 my-2"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                      <MessageSquare className="w-4 h-4 text-indigo-600" />
                      <span>Write Your Query</span>
                    </div>
                    <button
                      onClick={() => setIsEscalating(false)}
                      className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    Type your question, doubt, or issue below. Our team will review it and help you directly.
                  </p>

                  {user && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50/80 dark:bg-indigo-950/40 rounded-lg text-[11px] text-indigo-700 dark:text-indigo-300 font-medium border border-indigo-100 dark:border-indigo-900/50">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>Sending as <strong>{user.name}</strong> ({user.email})</span>
                    </div>
                  )}

                  <form onSubmit={handleSubmitTicket} className="space-y-2">
                    <textarea
                      required
                      rows={3}
                      value={formMessage}
                      onChange={(e) => setFormMessage(e.target.value)}
                      placeholder="Write your message here..."
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none resize-none transition-all placeholder:text-slate-400"
                    />

                    {ticketError && (
                      <p className="text-[11px] text-rose-600 font-medium">{ticketError}</p>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingTicket}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      {isSubmittingTicket ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sending...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>Submit Query</span>
                        </>
                      )}
                    </button>
                  </form>
                </motion.div>
              )}
            </div>

            {/* ── Modern Bottom Bar / Support Action ── */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button
                onClick={() => {
                  if (!user) {
                    toast.info("Please sign in to write a query to support.");
                    setIsOpen(false);
                    router.push("/login?redirect=" + encodeURIComponent(pathname || "/dashboard"));
                    return;
                  }
                  const nextState = !isEscalating;
                  setIsEscalating(nextState);
                  setSelectedCategoryKey(null);
                  if (nextState) {
                    setTimeout(() => {
                      document.getElementById("aptbot-escalation-form")?.scrollIntoView({ behavior: "smooth", block: "end" });
                    }, 80);
                  }
                }}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-indigo-50/60 dark:bg-slate-800 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 border border-slate-200/80 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl font-medium flex items-center justify-center gap-2 transition-all text-xs shadow-2xs group"
              >
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600 group-hover:scale-110 transition-transform" />
                <span>
                  {isEscalating ? "Close query box" : (
                    <>Didn't find your answer? <strong className="font-semibold underline decoration-indigo-300">Write your query</strong></>
                  )}
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
