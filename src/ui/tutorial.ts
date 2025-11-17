const TUTORIAL_STORAGE_KEY = 'supersplat.tutorialDismissed';

type Step = {
    title: string;
    description: string;
};

class TutorialOverlay {
    private steps: Step[];
    private current = 0;
    private container: HTMLDivElement;
    private titleEl: HTMLHeadingElement;
    private descEl: HTMLParagraphElement;
    private indicatorEl: HTMLSpanElement;

    constructor() {
        this.steps = [
            {
                title: 'Welcome to SuperSplat Vision Pro',
                description: 'This build boots with Apple M3 Max presets, Vision Pro ready defaults, and automatically loads our dragon sample so you can tweak splats immediately.'
            },
            {
                title: 'Edit with confidence',
                description: 'Use the toolbar to switch between move/rotate/scale, and press 1-3 to hop across gizmos. The data panel (D) and selection tools (R, B, O) are now tuned for high-density sets.'
            },
            {
                title: 'Publish anywhere',
                description: 'Package builds through the Vision Pro pipeline or the macOS app menu. Everything you see here matches the headset thanks to the shared render path.'
            }
        ];

        this.container = document.createElement('div');
        this.container.id = 'tutorial-overlay';
        this.container.classList.add('hidden');

        const card = document.createElement('div');
        card.className = 'tutorial-card';

        this.titleEl = document.createElement('h2');
        this.descEl = document.createElement('p');
        this.indicatorEl = document.createElement('span');
        this.indicatorEl.className = 'tutorial-indicator';

        const controls = document.createElement('div');
        controls.className = 'tutorial-controls';

        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Back';
        prevBtn.addEventListener('click', () => this.prev());

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Next';
        nextBtn.className = 'primary';
        nextBtn.addEventListener('click', () => this.next());

        const skipBtn = document.createElement('button');
        skipBtn.textContent = 'Skip Tutorial';
        skipBtn.className = 'ghost';
        skipBtn.addEventListener('click', () => this.dismiss());

        controls.appendChild(skipBtn);
        controls.appendChild(prevBtn);
        controls.appendChild(nextBtn);

        card.appendChild(this.indicatorEl);
        card.appendChild(this.titleEl);
        card.appendChild(this.descEl);
        card.appendChild(controls);

        this.container.appendChild(card);
        document.body.appendChild(this.container);
        this.updateUI();
    }

    private updateUI() {
        const step = this.steps[this.current];
        this.titleEl.textContent = step.title;
        this.descEl.textContent = step.description;
        this.indicatorEl.textContent = `${this.current + 1} / ${this.steps.length}`;
    }

    private prev() {
        this.current = Math.max(0, this.current - 1);
        this.updateUI();
    }

    private next() {
        if (this.current === this.steps.length - 1) {
            this.dismiss();
            return;
        }
        this.current = Math.min(this.steps.length - 1, this.current + 1);
        this.updateUI();
    }

    private dismiss() {
        this.container.classList.add('hidden');
        localStorage.setItem(TUTORIAL_STORAGE_KEY, 'true');
    }

    showIfNeeded() {
        if (localStorage.getItem(TUTORIAL_STORAGE_KEY) === 'true') {
            this.container.remove();
        } else {
            this.container.classList.remove('hidden');
        }
    }
}

export { TutorialOverlay };
