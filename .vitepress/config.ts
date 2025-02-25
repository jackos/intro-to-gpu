import { defineConfig } from 'vitepress'

const hostname: string = 'https://jackos.github.io'

export default defineConfig({
    appearance: "dark",
    lastUpdated: true,
    outDir: 'dist',
    cleanUrls: true,
    lang: 'en-US',
    title: 'Intro to GPU with Mojo',
    description: 'Learn how to program GPUs using Mojo',
    sitemap: { hostname: hostname },
    markdown: { theme: 'tokyo-night' },
    themeConfig: {
        logo: '/logo.svg',
        search: {
            provider: 'local',
            options: { detailedView: true }
        },
        socialLinks: [
            { icon: 'github', link: 'https://github.com/jackos' },
            { icon: 'twitter', link: 'https://x.com/jack_clayto' },
            { icon: 'linkedin', link: 'https://www.linkedin.com/in/jackclayton/' },
        ],
        editLink: {
            pattern: 'https://github.com/jackos/jackos.github.io/edit/main/:path',
            text: 'Edit this page on GitHub',
        },
        nav: [
            { text: 'Home', link: '/' },
            { text: 'Contact', link: 'mailto:jackos@me.com' },
        ],
        sidebar: [
            { text: 'Getting Started', link: '/' },
            { text: 'Intro to GPU', link: '/intro-to-gpu' },
            { text: 'Systems Programming', link: '/systems-programming' },
            { text: 'Glossary', link: '/glossary' },
        ],
    },
    head: [
        ['meta', { name: 'theme-color', content: '#008000' }],
        ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }],
        ['meta', { name: 'author', content: 'Jack Clayton' }],
        ['meta', { name: 'referrer', content: 'no-referrer-when-downgrade' }],
        ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
        ['link', { rel: 'icon', type: "image/png", sizes: '32x32', href: '/favicon-32x32.png' }],
        ['link', { rel: 'icon', type: "image/png", sizes: '96x96', href: '/favicon-96x96.png' }],
        ['link', { rel: 'manifest', href: '/site.webmanifest' }],
        ['link', { rel: 'shortcut icon', href: '/favicon.ico' }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:site', content: '@jack_clayto' }],
        ['meta', { name: 'twitter:creator', content: '@jack_clayto' }],
        ['meta', { property: 'og:site_name', content: 'Intro to GPU with Mojo' }],
        ['meta', { property: 'og:locale', content: 'en_US' }]
    ],
})
