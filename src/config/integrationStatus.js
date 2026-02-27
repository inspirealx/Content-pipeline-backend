// src/config/integrationStatus.js

module.exports = {
    // AI Content Generation
    gemini: {
        name: 'Google Gemini',
        category: 'ai_generation',
        status: 'active', // 'active', 'beta', 'coming_soon', 'disabled'
        description: 'AI-powered content generation with Google Gemini',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg',
        features: ['Content generation', 'Script writing', 'Idea expansion'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER']
    },

    openai: {
        name: 'ChatGPT / OpenAI',
        category: 'ai_generation',
        status: 'active',
        description: 'Generate content with GPT-4 and GPT-3.5',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg',
        features: ['Content generation', 'Copywriting', 'Brainstorming'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER']
    },

    // Social Media Publishing (Order: facebook, insta, linkedin, twitter, youtube, rest)
    facebook_page: {
        name: 'Facebook (Pages)',
        category: 'publishing',
        status: 'beta',
        description: 'Publish to Facebook pages',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg',
        features: ['Page posts', 'Image posts', 'Video posts'],
        releaseDate: 'Q1 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'],
        betaNote: 'OAuth connected. Publishing being tested.'
    },

    facebook_profile: {
        name: 'Facebook (Profile)',
        category: 'publishing',
        status: 'beta',
        description: 'Publish to personal Facebook profile',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg',
        features: ['Profile posts', 'Image posts'],
        releaseDate: 'Q1 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'],
        betaNote: 'OAuth connected. Publishing being tested.'
    },

    instagram: {
        name: 'Instagram',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish to Instagram business accounts',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/e/e7/Instagram_logo_2016.svg',
        features: ['Feed posts', 'Stories', 'Reels'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    linkedin_profile: {
        name: 'LinkedIn (Personal Profile)',
        category: 'publishing',
        status: 'active',
        description: 'Publish posts to your LinkedIn personal profile',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/8/81/LinkedIn_icon.svg',
        features: ['Text posts', 'Image posts', 'Scheduling'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER']
    },

    linkedin_pages: {
        name: 'LinkedIn (Company Pages)',
        category: 'publishing',
        status: 'beta',
        description: 'Publish to LinkedIn Company Pages you manage',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/8/81/LinkedIn_icon.svg',
        features: ['Company page posting', 'Multi-page management'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE'],
        betaNote: 'Currently in beta. OAuth works, publishing in development.'
    },

    twitter: {
        name: 'Twitter / X',
        category: 'publishing',
        status: 'active',
        description: 'Publish tweets and threads to X (formerly Twitter)',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/c/ce/X_logo_2023.svg',
        features: ['Tweets', 'Threads', 'Image posts'],
        releaseDate: null,
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    youtube: {
        name: 'YouTube',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Upload and manage YouTube videos',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg',
        features: ['Video upload', 'Description management', 'Shorts'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    wordpress: {
        name: 'WordPress',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish articles directly to your WordPress blog',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/0/09/Wordpress-Logo.svg',
        features: ['Blog post routing', 'Draft support', 'Featured images'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    reddit: {
        name: 'Reddit',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Submit text and link posts to subreddits',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/b/b4/Reddit_logo.svg',
        features: ['Text posts', 'Link submissions', 'Subreddit targeting'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    medium: {
        name: 'Medium',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish long-form articles to Medium',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Medium_logo_Monogram.svg',
        features: ['Article publishing', 'Draft import'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    tiktok: {
        name: 'TikTok',
        category: 'publishing',
        status: 'coming_soon',
        description: 'Publish videos to TikTok',
        icon: 'https://upload.wikimedia.org/wikipedia/en/a/a9/TikTok_logo.svg',
        features: ['Video upload', 'Caption management'],
        releaseDate: 'Q3 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    // AI Media Generation
    sora: {
        name: 'OpenAI Sora',
        category: 'ai_media',
        status: 'coming_soon',
        description: 'High-quality AI video generation using Sora',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg',
        features: ['Text to Video', 'High visual fidelity', 'Long format video'],
        releaseDate: '2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    },

    elevenlabs: {
        name: 'ElevenLabs',
        category: 'ai_media',
        status: 'beta',
        description: 'AI voice generation for video reels',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/d/df/ElevenLabs_logo.svg',
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
        icon: 'https://cdn.brandfetch.io/heygen.com/w/400/h/400',
        features: ['AI avatars', 'Video generation', 'Multi-language'],
        releaseDate: 'Q2 2025',
        visibleTo: ['USER', 'ADMIN', 'TESTER', 'ENTERPRISE']
    }
};
