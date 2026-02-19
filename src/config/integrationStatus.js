// src/config/integrationStatus.js

module.exports = {
    // AI Content Generation
    gemini: {
        name: 'Google Gemini',
        category: 'ai_generation',
        status: 'active', // 'active', 'beta', 'coming_soon', 'disabled'
        description: 'AI-powered content generation with Google Gemini',
        icon: '/assets/icons/gemini.svg',
        features: ['Content generation', 'Script writing', 'Idea expansion'],
        releaseDate: null, // null if already released
        visibleTo: ['USER', 'ADMIN', 'TESTER'] // Matches Prisma Enum values
    },

    openai: {
        name: 'ChatGPT / OpenAI',
        category: 'ai_generation',
        status: 'active',
        description: 'Generate content with GPT-4 and GPT-3.5',
        icon: '/assets/icons/openai.svg',
        features: ['Content generation', 'Copywriting', 'Brainstorming'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER']
    },

    // Social Media Publishing
    linkedin_profile: {
        name: 'LinkedIn (Personal Profile)',
        category: 'publishing',
        status: 'active',
        description: 'Publish posts to your LinkedIn personal profile',
        icon: '/assets/icons/linkedin.svg',
        features: ['Text posts', 'Image posts', 'Scheduling'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER']
    },

    linkedin_pages: {
        name: 'LinkedIn (Company Pages)',
        category: 'publishing',
        status: 'beta', // In development, works for admins only
        description: 'Publish to LinkedIn Company Pages you manage',
        icon: '/assets/icons/linkedin.svg',
        features: ['Company page posting', 'Multi-page management'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'], // Visible to all
        betaNote: 'Currently in beta. OAuth works, publishing in development.'
    },

    twitter: {
        name: 'Twitter / X',
        category: 'publishing',
        status: 'active',
        description: 'Publish tweets and threads to X (formerly Twitter)',
        icon: '/assets/icons/twitter.svg',
        features: ['Tweets', 'Threads', 'Image posts'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    facebook: {
        name: 'Facebook',
        category: 'publishing',
        status: 'beta',
        description: 'Publish to Facebook profiles and pages',
        icon: '/assets/icons/facebook.svg',
        features: ['Profile posts', 'Page posts', 'Image posts'],
        releaseDate: 'Q1 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'],
        betaNote: 'OAuth connected. Publishing being tested.'
    },

    instagram: {
        name: 'Instagram',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish to Instagram business accounts',
        icon: '/assets/icons/instagram.svg',
        features: ['Feed posts', 'Stories', 'Reels'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    medium: {
        name: 'Medium',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish long-form articles to Medium',
        icon: '/assets/icons/medium.svg',
        features: ['Article publishing', 'Draft import'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    tiktok: {
        name: 'TikTok',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish videos to TikTok',
        icon: '/assets/icons/tiktok.svg',
        features: ['Video upload', 'Caption management'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    youtube: {
        name: 'YouTube',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Upload and manage YouTube videos',
        icon: '/assets/icons/youtube.svg',
        features: ['Video upload', 'Description management', 'Shorts'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    // AI Media Generation
    elevenlabs: {
        name: 'ElevenLabs',
        category: 'ai_media',
        status: 'beta',
        description: 'AI voice generation for video reels',
        icon: '/assets/icons/elevenlabs.svg',
        features: ['Text-to-speech', 'Voice cloning', 'Reel audio'],
        releaseDate: 'Q1 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'],
        betaNote: 'Setup started. Audio generation working.'
    },

    heygen: {
        name: 'HeyGen',
        category: 'ai_media',
        status: 'coming_soon',
        description: 'AI avatar video generation',
        icon: '/assets/icons/heygen.svg',
        features: ['AI avatars', 'Video generation', 'Multi-language'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    }
};
