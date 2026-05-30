/**
 * About page — project info, buy me a coffee, contact.
 * Modeled after CWESST's about/support popovers.
 */

import { escapeHtml } from '../dom.js';

export async function render($container, params) {
    console.log('[About] Rendering about page');

    $container.html(`
        <div class="panel about-page">
            <h1>About C.W.'s O-POD</h1>

            <section class="about-section">
                <h2>What Is O-POD?</h2>
                <p>
                    <strong>O-POD</strong> — Open Print-On-Demand — is a self-hosted web application
                    that turns public domain texts into beautiful, print-ready physical books.
                </p>
                <p>
                    It provides a guided workflow from source selection through typesetting,
                    cover design, and print-on-demand ordering — with the goal of making the
                    entire process nearly one-click.
                </p>
                <h3>Features</h3>
                <ul>
                    <li>Search <a href="https://www.gutenberg.org/" target="_blank">Project Gutenberg</a> and <a href="https://standardebooks.org/" target="_blank">Standard Ebooks</a> for public domain texts</li>
                    <li>AI-powered typo correction (chapter by chapter)</li>
                    <li>Professional typesetting with <a href="https://typst.app/" target="_blank">Typst</a> (front matter, running headers, page numbers)</li>
                    <li>AI-generated cover art with an interactive Cover Builder</li>
                    <li>Print &amp; ship via <a href="https://www.lulu.com/sell/sell-on-your-site/print-api" target="_blank">Lulu xPress</a>, <a href="https://www.bookvault.app/" target="_blank">BookVault</a>, or <a href="https://kdp.amazon.com/" target="_blank">KDP Print</a></li>
                    <li>Full bookshelf management with batch operations</li>
                </ul>
            </section>

            <hr>

            <section class="about-section">
                <h2>Created By</h2>
                <h3>C.W. Holeman III</h3>
                <p>
                    For more information about the creator, see
                    <a href="https://www.cwholemaniii.com/cwopod" target="_blank">www.cwholemaniii.com/cwopod</a>.
                </p>
                <p>
                    For the most up-to-date version of O-POD, see the project on
                    <a href="https://github.com/cwhiii/cwopod" target="_blank">GitHub</a>.
                </p>
            </section>

            <hr>

            <section class="about-section">
                <h2>Buy Me a Coffee</h2>
                <p>
                    Enjoying this tool? Getting a lot of value from it? I'd love to hear from
                    you. I also wouldn't complain if you bought me a coffee (or a car). You can
                    do that here:
                </p>
                <div class="paypal-support">
                    <a href="https://www.paypal.me/cwhiii" target="_blank" class="btn primary">
                        Support via PayPal
                    </a>
                    <img src="/assets/paypal-qr.svg" alt="QR code for PayPal donation link" class="paypal-qr" />
                </div>
                <p>
                    <a href="https://www.cwholemaniii.com/cwopod" target="_blank">
                        Learn more about O-POD
                    </a>
                </p>
            </section>

            <hr>

            <section class="about-section">
                <h2>Contact</h2>
                <p>
                    If you're looking for <strong>my books</strong>, etc., here is the
                    <a href="https://www.cwholemaniii.com/cwopod" target="_blank">contact info</a>.
                </p>
                <p>
                    If you're trying to contact me about <strong>this tool</strong>, you can find all that
                    info <a href="https://www.cwholemaniii.com/cwopod" target="_blank">here</a>.
                </p>
                <p>
                    Or email me directly about O-POD at:
                    <a href="mailto:cwopod@cwholemaniii.com">cwopod@cwholemaniii.com</a>
                </p>
            </section>

            <hr>

            <section class="about-section">
                <h2>License</h2>
                <p>MIT — free to use, modify, and distribute.</p>
            </section>

            <section class="about-section about-credits">
                <p><small>Some icons by <a href="https://icons8.com/" target="_blank">icons8.com</a>.</small></p>
            </section>
        </div>
    `);

    console.log('[About] About page rendered');
}
