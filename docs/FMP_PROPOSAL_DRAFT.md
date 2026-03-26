# FMP Project Proposal Draft

## Project Title
**NUR: A Local AI-Powered EPUB Reader with Offline Text-to-Speech, Voice Personalisation and Multilingual Page Translation**

## Front Page Details
- **Student Name:** [Your Name]
- **Student No:** [Your Student Number]
- **Supervisor 1:** [Supervisor 1]
- **Supervisor 2:** [Supervisor 2]  
- **Course:** Bachelor of Science in Computer Science (2023-2026)
- **Version:** 1.0

## Project Categories
- [x] Desktop Application / Information System
- [x] Problem Solving and Artificial Intelligence
- [ ] Web Application / Cloud-based Information System
- [ ] Simulation and Modelling
- [ ] Smartphone Application
- [ ] Smartphone Game
- [ ] Computer Networks and Cloud Infrastructure
- [ ] Image Processing and Computer Vision
- [ ] Other: Accessibility Technology

## Abstract
This project proposes the design and implementation of **NUR**, a desktop EPUB reader that converts digital books into spoken audio locally using artificial intelligence based text-to-speech. The system is intended for users who want a private, offline and customisable reading experience without uploading books or voice data to a cloud service. NUR will combine an EPUB reader, a local speech generation pipeline, voice selection, reading progress synchronisation and multilingual page translation inside one desktop application. The system will be designed as a local-first product, meaning that book content, audio generation, user settings and reading history remain on the user’s own machine.

The project is significant because many existing text-to-speech reading applications are either cloud-dependent, subscription-based, limited in customisation, or not designed specifically for long-form EPUB reading. NUR aims to address these problems by offering a free and open-source alternative that supports both fast local reading and higher-quality local narration. The project will also allow investigation into desktop software architecture, AI model orchestration, audio buffering, interface design and accessibility. The final outcome will be a working desktop application that demonstrates how local AI can be used to improve reading and listening experiences in a practical and privacy-preserving way.

## Introduction
This proposal presents the planned development of NUR, a local AI-assisted EPUB reader for desktop devices. The purpose of the project is to create a system that allows a user to import an EPUB book, read it visually and listen to it as synchronised spoken audio within the same application. The project is motivated by the growing interest in accessibility, local AI, and private computing. Many people consume long-form reading material through audio, yet current solutions often depend on proprietary services, subscriptions or permanent internet access. This project therefore focuses on an alternative approach in which speech is generated entirely on the user’s device. The system will be developed as a desktop application because desktop environments provide better access to local files, local AI models and persistent user settings than browser-only solutions. The application will include a library screen, a reading view, a voice management area and settings for appearance and playback. It will also include page-level translation to support multilingual reading and translated speech preview. From a technical perspective, the project combines frontend, backend and AI integration work in one complete software product. This makes it suitable as a final year computing project because it involves design, implementation, testing, evaluation and documentation across several areas of computer science.

## Problem Statement
Reading applications with text-to-speech already exist, but they do not fully solve the needs of users who want privacy, offline access and high control over how books are narrated. Many mainstream products rely on cloud services to process text and generate audio, which means the user must trust a third party with book content and usage data. This can be a concern for privacy-sensitive users, students, researchers and readers working with personal or copyrighted material. In addition, many AI voice platforms operate as subscription services, which creates an ongoing cost barrier. Some open-source EPUB readers provide read-aloud support, but they often depend on operating-system voices and do not offer modern local neural voices or voice personalisation. Other systems provide natural speech, but they are not built specifically for EPUB reading with sentence-level highlighting and reading progress synchronisation. There is therefore a gap between accessibility-focused readers and high-quality AI narration tools. Another problem is that local AI text-to-speech is technically difficult to integrate into a consumer desktop application because it involves model download, runtime management, audio buffering and packaging. A further challenge is that long-form reading requires smoother playback than short text generation, so buffering and sentence transitions must be handled carefully. Translation is another related issue, because readers may want to understand or hear a page in another language without leaving the book. Existing apps rarely combine local reading, local speech, visual synchronisation and local translation in one coherent system. This project is being developed to explore whether a desktop application can provide these capabilities in a free and open-source form. A re-implementation of this kind of system is valuable for learning because it requires full-stack engineering rather than isolated programming exercises. Through this project, I expect to strengthen my skills in desktop application development, React and TypeScript, Python backend development, API design, AI model integration, performance optimisation, software packaging and user-centred interface design. I also expect to gain experience in evaluating trade-offs between quality, speed, usability and hardware limitations in local AI applications.

## Problem Solution for Proposed System
The proposed solution is a desktop application called NUR that unifies EPUB reading and local AI speech generation in a single interface. The user will be able to import EPUB books into a local library and open them in a dedicated reader view. The application will parse the book, paginate the content and maintain the user’s current page and reading progress. A local text-to-speech backend will generate narration from the visible book content without sending the text to an external service. The system will provide two speech paths: a fast default local engine for responsive playback and a higher-quality local engine for more natural narration on capable hardware. The reader will visually highlight the currently spoken sentence so that text and audio stay synchronised. The user will also be able to save voice samples, adjust appearance settings and choose the reading style that suits them best. For multilingual support, the system will provide local page translation and translated speech preview using on-device models. The final application will package the backend, frontend and resources together so that the user can install and run the software as a normal desktop application. In this way, the system addresses privacy, cost, accessibility and control while also demonstrating a practical local AI software architecture.

## Related System Analysis
Existing systems show that there is clear demand for audio-first reading, but they also reveal gaps that NUR can address.

**Speechify** is a widely used text-to-speech platform that supports documents, web pages and multiple devices. It offers high-quality voices, OCR support and strong convenience features, which makes it attractive for general reading use. However, it is primarily a commercial platform and depends heavily on cloud services and account-based access. This limits transparency and reduces local control over user data, processing and pricing. For a free open-source project, its cloud-first model is a significant contrast to the goals of NUR.

**ElevenReader** focuses on natural AI narration and a strong listening experience for books, articles and uploaded text. It demonstrates how important voice quality and pacing are for long-form listening. However, it is proprietary and service-based, which means the user is dependent on the provider’s infrastructure, policies and feature restrictions. It is not intended as a transparent, fully local or open-source platform. NUR takes inspiration from its listening quality but aims to provide that experience in a local desktop workflow.

**Thorium Reader** is an open-source EPUB reader with strong accessibility goals and built-in read-aloud support. It already shows the value of highlighting, navigation and reading controls inside an EPUB reader. However, Thorium mainly relies on operating-system voices rather than integrated local neural voice models, which limits voice quality and voice cloning flexibility. It is also not designed around a dedicated local AI narration pipeline. NUR extends this area by exploring how a modern EPUB reader can integrate local neural TTS and translation while preserving the benefits of an accessible reader.

### Table 1: Related System Analysis with Proposed Project Solution

| Application Name | Weakness | Proposed Project Solution |
|---|---|---|
| Speechify | Cloud-dependent, subscription-based, limited transparency for local processing | NUR will provide offline local processing, open-source code and no mandatory subscription model |
| ElevenReader | Proprietary platform, account ecosystem, limited local control over models and data | NUR will keep books, voices and settings on the user’s machine and allow users to inspect or extend the codebase |
| Thorium Reader | Depends largely on operating-system voices and does not focus on local neural voice quality or voice personalisation | NUR will integrate local neural TTS engines, voice management and synchronised narration directly into the reading experience |

This comparison shows that the contribution of the proposed project is not simply “another reader” or “another TTS app.” Its contribution is the combination of local EPUB reading, local AI narration, synchronised playback, user-controlled voices and multilingual page translation in one free and open-source desktop product.

## Advantages / Benefits of Proposed System
- The system protects user privacy because books and voice data remain on the user’s device.
- The project reduces dependence on subscriptions and third-party AI services.
- The application improves accessibility by combining reading and listening in one interface.
- The system supports user control through adjustable themes, playback settings and voice options.
- The project demonstrates a practical use of local AI models in a real-world desktop application.
- The multilingual page translation feature can help users understand and listen to content in another language.
- The project is open source, which supports learning, transparency and future community contribution.

## Scope
The scope of this project is the design and implementation of a desktop EPUB reading application with local AI narration. The project will include a library for importing and storing EPUB files locally. It will include a dedicated reader interface with page navigation, visual reading progress and synchronised text highlighting during playback. The system will support local text-to-speech generation through at least two engines: one prioritising speed and one prioritising quality. The project will include a voice management area so that users can store and reuse voice samples where supported by the local model. Reader settings such as font, spacing, theme and playback preferences will be persisted locally between sessions. The system will also provide page-level translation and translated speech preview for a limited set of supported languages. The application will package its frontend and backend into an installable desktop app so that end users can run it without manually starting separate services. The project will cover testing of usability, stability and the practical performance limitations of local AI narration on consumer hardware. The project will not include cloud sync, user accounts or online storage. It will not target mobile platforms as part of the main deliverable. It will not attempt to support DRM-protected ebooks or scanned documents requiring OCR. It will also not aim to become a full commercial audiobook production suite; instead, it will focus on private reading, listening and accessibility in a local desktop context.

## Modules

### Module 1: Library and EPUB Import Module
This module will allow users to import EPUB books from local storage into a persistent library. It will store core metadata such as title, cover image, file path and reading progress. The purpose of this module is to give the user a simple way to manage books without relying on online accounts or external servers. It will also support reopening previously imported books and returning the user to their last saved location. This module is important because the rest of the application depends on stable local content management. It forms the entry point to the user experience and provides the foundation for reading, speech generation and progress persistence.

### Module 2: Reader and Synchronisation Module
This module will display the EPUB content in a paginated reading interface and manage navigation between sections and pages. It will preserve the user’s current location when window size, theme or layout settings change. During playback, it will highlight the current sentence and automatically move to the next page when narration progresses. It will also include table of contents navigation and appearance controls such as font, theme and spacing. This module is central to the project because it transforms a standard reading view into a synchronised read-along experience. The module will be evaluated based on readability, responsiveness and how accurately it keeps visual and spoken positions aligned.

### Module 3: Local AI Text-to-Speech and Voice Module
This module will manage the speech generation pipeline for the application. It will download or prepare the required local models, generate speech from book text and handle audio buffering for smoother playback. It will provide both a fast default voice path and a higher-quality local narration path for more natural speech on capable hardware. It will also support voice sample management for personalisation where the selected model allows this. This module is one of the most technically significant parts of the project because it involves model orchestration, cancellation, caching and audio scheduling. It directly addresses the core aim of making EPUB listening possible without a cloud TTS service.

### Module 4: Translation and Multilingual Preview Module
This module will allow the user to translate the currently visible page into a supported target language and optionally hear the translated page spoken aloud. The translation will be performed locally using on-device models rather than external APIs. The user will be able to switch between the original and translated version of the page inside the reader. This module extends the project beyond accessibility into multilingual support and reading assistance. It is especially useful for users who want to compare source and translated text while staying within the same reading flow. The module will intentionally remain page-scoped rather than whole-book translation to keep the processing cost manageable on consumer hardware.

### Module 5: Settings, Persistence and Deployment Module
This module will store the user’s preferences and ensure they are restored between sessions. It will include settings for theme, typography, playback behaviour and system diagnostics. It will also handle packaging concerns such as backend startup, resource discovery and installer creation. This module is necessary to make the project feel like a complete desktop application rather than a prototype. It addresses important non-functional requirements such as usability, persistence and release-readiness. The final evaluation of the project will depend partly on how well this module supports a smooth first-run experience and stable packaged deployment.

## System Limitations / Constraints
- High-quality local narration depends on the user’s hardware, especially available CPU/GPU performance and memory.
- The project is limited to EPUB content and will not support DRM-protected ebook ecosystems.
- Local translation will initially support only a small number of target languages to keep the project feasible.
- Natural speech quality may still be lower than premium cloud services in some cases, because the project prioritises local and open-source solutions.

## Software Process Methodology
The project will use an **Agile, iterative and object-oriented development methodology**. This approach is suitable because the project combines user interface design, AI integration and desktop deployment, all of which benefit from incremental refinement and frequent testing. Each major feature will be developed in small iterations, such as reader playback, settings persistence, voice management and translation. An object-oriented approach also fits the modular architecture of the system, where the frontend, backend services and model managers can be separated into maintainable components. This methodology is appropriate for a project where usability, performance and reliability must be improved continuously during development.

## Tools and Technologies

### Table 2: Tools and Technologies for Proposed Project

| Tools | Version | Rationale |
|---|---|---|
| Visual Studio Code | Latest stable | Main IDE for development |
| Git and GitHub | Latest stable | Version control and source code management |
| Figma | Latest stable | Wireframes and interface mockups |
| Microsoft Word | Latest stable | Report writing and documentation |
| Microsoft PowerPoint | Latest stable | Final presentation |
| Node.js | 22.x | JavaScript runtime for Electron development tooling |
| Python | 3.10 / 3.11 | Backend runtime for local AI and API services |

| Technology | Version | Rationale |
|---|---|---|
| Electron | 39.2.6 | Cross-platform desktop application framework |
| React | 19.2.1 | Frontend user interface development |
| TypeScript | 5.9.3 | Type-safe frontend and desktop logic |
| Tailwind CSS | 4.1.18 | Rapid UI styling and theme control |
| FastAPI | Latest stable | Local backend API for TTS and translation features |
| EPUB.js | 0.3.93 | EPUB parsing and rendering support |
| Chatterbox TTS | 0.1.6 | Higher-quality local speech generation |
| Piper TTS | Latest stable | Fast offline local text-to-speech generation |
| Electron Builder | 26.0.12 | Desktop packaging and installer generation |

## Data Gathering Approach
The project requirements will be gathered using a mixed practical and comparative approach. First, I will review similar existing systems such as Speechify, ElevenReader and Thorium Reader in order to identify useful features, weaknesses and user experience patterns. Second, I will use informal user-centred feedback from classmates, friends or potential readers to understand expectations around readability, audio quality, controls and privacy. Third, I will gather technical requirements through experimentation with local TTS models, EPUB rendering tools and desktop packaging workflows. This approach is appropriate because the project depends both on user experience requirements and on the practical limits of current local AI tools.

## Concepts

### Concept 1: Local-First Artificial Intelligence
This concept refers to running AI models directly on the user’s own machine instead of relying on cloud inference. In this project, it is central because both speech generation and translation are designed to happen locally. This supports privacy, offline use and user ownership of data. It also introduces important technical trade-offs around hardware performance and packaging.

### Concept 2: Neural Text-to-Speech
Neural text-to-speech is the use of machine learning models to convert written text into spoken audio. This concept is at the centre of the project because the application depends on speech quality, intelligibility and playback smoothness. The project will explore the difference between faster local voices and more natural but heavier local models. It will also evaluate the buffering strategies required for long-form narration.

### Concept 3: Voice Personalisation and Voice Cloning
Voice personalisation allows a user to choose or provide a preferred voice for audio output. In this project, voice management is important because it increases user control and makes the application more engaging. The concept also raises technical and ethical questions around sample quality, voice identity and responsible use. Implementing this feature will deepen understanding of AI model conditioning and media processing.

### Concept 4: EPUB Parsing and Synchronised Reading
EPUB parsing is the process of reading and structuring the contents of an EPUB file for display and interaction. This concept is important because the system must link the visual page, sentence boundaries and spoken output together. Synchronised reading requires careful mapping between text blocks and audio playback position. It therefore combines document processing, interface logic and media control in one workflow.

### Concept 5: Desktop Software Architecture and IPC
Modern desktop apps often separate interface logic from system-level processes. In this project, Electron provides the desktop shell, while a local Python backend provides AI services. These layers communicate through local APIs and inter-process communication. Understanding this concept is essential for building a stable, modular and maintainable application.

## Gantt Chart Draft
Use these dates as a starting point and adjust them to match your actual academic schedule.

| Task / Module | Start Date | End Date | Dependency |
|---|---|---|---|
| Project research and requirement analysis | 06 Oct 2025 | 24 Oct 2025 | None |
| Related systems review and proposal writing | 13 Oct 2025 | 07 Nov 2025 | Project research |
| System design, wireframes and architecture planning | 27 Oct 2025 | 21 Nov 2025 | Requirement analysis |
| Library and EPUB reader implementation | 24 Nov 2025 | 19 Dec 2025 | System design |
| Local TTS backend integration | 05 Jan 2026 | 30 Jan 2026 | Reader implementation |
| Voice management and settings persistence | 02 Feb 2026 | 20 Feb 2026 | TTS integration |
| Translation and multilingual preview | 23 Feb 2026 | 13 Mar 2026 | TTS integration |
| Testing, optimisation and packaging | 16 Mar 2026 | 10 Apr 2026 | All major modules |
| Final report, evaluation and presentation prep | 13 Apr 2026 | 01 May 2026 | Testing and packaging |

## Mockups
Use screenshots or designed mockups for these core screens:
- Library dashboard showing imported books and recent reads
- Reader screen with synchronised playback and highlighted text
- Voice Studio screen for adding and managing voice samples
- Settings screen for appearance, playback and diagnostics
- Translation-enabled reader screen showing translated page content and translated audio controls

## Conclusion
This proposal outlines a final year project focused on building a practical and privacy-preserving local AI reading system. The proposed application, NUR, combines EPUB reading, local narration, user settings, voice personalisation and translation in one desktop product. The project is academically valuable because it involves interface design, software architecture, artificial intelligence integration, testing and deployment. It also addresses a real user problem by offering a free open-source alternative to cloud-dependent reading tools. Overall, the project is both technically challenging and feasible within the scope of an undergraduate computing project.

## References
- EDRLab (n.d.) *Accessibility | Thorium Reader*. Available at: https://thorium.edrlab.org/en/docs/300_accessibility/ (Accessed: 25 March 2026).
- EDRLab (n.d.) *Text to Speech (TTS) | Thorium Reader*. Available at: https://thorium.edrlab.org/en/docs/210_reading/230_tts/ (Accessed: 25 March 2026).
- ElevenLabs (n.d.) *ElevenReader*. Available at: https://elevenreader.io/ (Accessed: 25 March 2026).
- ElevenLabs (2025) *What’s New in ElevenReader*. Available at: https://elevenreader.io/blog/whats-new-in-elevenreader (Accessed: 25 March 2026).
- Resemble AI (n.d.) *Chatterbox TTS*. Available at: https://github.com/resemble-ai/chatterbox (Accessed: 25 March 2026).
- Rhasspy (n.d.) *Piper: A fast, local neural text to speech system*. Available at: https://github.com/rhasspy/piper (Accessed: 25 March 2026).
- Speechify (n.d.) *Speechify: Free Text to Speech with Lifelike AI Voices*. Available at: https://speechify.com/text-to-speech/ (Accessed: 25 March 2026).
- Speechify (n.d.) *Download Speechify*. Available at: https://speechify.com/download/ (Accessed: 25 March 2026).
