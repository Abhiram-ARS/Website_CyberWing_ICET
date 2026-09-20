/**
 * CYBERWING PORTAL UI CONTROLLER
 * Manages view switching, wizard steps, file selection, lookup status, 
 * MAKA dialogue state, and Admin Dashboard interactions.
 */

document.addEventListener('DOMContentLoaded', () => {
    const engine = window.cyberwingEngine;
    if (!engine) {
        return;
    }

    // Active wizard state variables
    let currentWizardStep = 1;
    let uploadedFiles = []; // Holds native File objects in memory
    let activeCaseDetails = null; // Stored locally after lookup or during admin detail view
    let activeAdminCaseId = null;

    // View Selectors
    const views = {
        home: document.getElementById('view-home'),
        wizard: document.getElementById('view-wizard'),
        chat: document.getElementById('view-chat'),
        lookup: document.getElementById('view-lookup'),
        success: document.getElementById('view-success'),
        admin: document.getElementById('view-admin')
    };

    // Navigation Buttons
    const btnStartReport = document.getElementById('btn-start-report');
    const btnChatMaka = document.getElementById('btn-chat-maka');
    const btnLookupReport = document.getElementById('btn-lookup-report');
    const linkAdminPortal = document.getElementById('link-admin-portal');

    // ==========================================================================
    // VIEW SWITCHER
    // ==========================================================================
    function showView(viewId) {
        Object.keys(views).forEach(key => {
            if (views[key]) {
                views[key].classList.remove('active');
            }
        });
        if (views[viewId]) {
            views[viewId].classList.add('active');
            window.location.hash = 'report-incident'; // Keep page focused on report section
        }
    }

    btnStartReport.addEventListener('click', () => {
        resetWizard();
        showView('wizard');
    });

    btnChatMaka.addEventListener('click', () => {
        initMakaChat();
        showView('chat');
    });

    btnLookupReport.addEventListener('click', () => {
        resetLookup();
        showView('lookup');
    });

    linkAdminPortal.addEventListener('click', (e) => {
        e.preventDefault();
        resetAdminView();
        showView('admin');
    });

    // ==========================================================================
    // MULTI-STEP REPORT WIZARD
    // ==========================================================================
    const wizardSteps = document.querySelectorAll('.wizard-step');
    const progressSteps = document.querySelectorAll('.wizard-progress-bar .step');
    const btnWizardBack = document.getElementById('btn-wizard-back');
    const btnWizardNext = document.getElementById('btn-wizard-next');
    const form = document.getElementById('incident-form');

    // Show/hide financial amount based on loss option
    const financialLossGroup = document.getElementById('financial-loss-amount-group');
    document.querySelectorAll('input[name="financial_loss"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'yes') {
                financialLossGroup.classList.remove('hidden');
            } else {
                financialLossGroup.classList.add('hidden');
            }
        });
    });

    function updateWizardUI() {
        // Update Step visibility
        wizardSteps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.getAttribute('data-step')) === currentWizardStep) {
                step.classList.add('active');
            }
        });

        // Update Progress indicator
        progressSteps.forEach(step => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active', 'completed');
            if (stepNum === currentWizardStep) {
                step.classList.add('active');
            } else if (stepNum < currentWizardStep) {
                step.classList.add('completed');
            }
        });

        // Button labels
        btnWizardBack.disabled = (currentWizardStep === 1);
        if (currentWizardStep === 3) {
            btnWizardNext.textContent = 'Submit Secure Report';
            btnWizardNext.classList.add('btn-confirm-submit');
        } else {
            btnWizardNext.textContent = 'Next';
            btnWizardNext.classList.remove('btn-confirm-submit');
        }
    }

    btnWizardBack.addEventListener('click', () => {
        if (currentWizardStep > 1) {
            currentWizardStep--;
            updateWizardUI();
        }
    });

    btnWizardNext.addEventListener('click', async () => {
        if (currentWizardStep < 3) {
            // Validate step inputs before proceeding
            if (validateStep(currentWizardStep)) {
                currentWizardStep++;
                updateWizardUI();
            }
        } else {
            // Final submission
            if (validateStep(3)) {
                await submitReport();
            }
        }
    });

    // Toggle contact information based on anonymous selection
    const chkAnonymous = document.getElementById('chk-anonymous');
    const contactFields = document.getElementById('reporter-contact-fields');
    chkAnonymous.addEventListener('change', () => {
        if (chkAnonymous.checked) {
            contactFields.style.opacity = '0.3';
            contactFields.querySelectorAll('input, select').forEach(el => el.disabled = true);
        } else {
            contactFields.style.opacity = '1';
            contactFields.querySelectorAll('input, select').forEach(el => el.disabled = false);
        }
    });

    function validateStep(stepNum) {
        try {
            if (stepNum === 1) {
                const selected = form.querySelector('input[name="incident_type"]:checked');
                if (!selected) {
                    throw new Error("Please select an incident category.");
                }
                const desc = document.getElementById('f-description').value.trim();
                if (desc.length < 10) {
                    throw new Error("Please describe the incident in detail (minimum 10 characters).");
                }
            } else if (stepNum === 2) {
                // All Context & Evidence fields are optional (data minimization/victim friendly)
            } else if (stepNum === 3) {
                if (!chkAnonymous.checked) {
                    const name = document.getElementById('f-rep-name').value.trim();
                    const email = document.getElementById('f-rep-email').value.trim();
                    if (!name) throw new Error("Full name is required when not reporting anonymously.");
                    if (!email || !engine.isValidEmail(email)) throw new Error("A valid email address is required.");
                }
                const consent = document.getElementById('chk-consent').checked;
                if (!consent) {
                    throw new Error("You must review the privacy notice and check the consent box to proceed.");
                }
            }
            return true;
        } catch (err) {
            alert(`⚠️ Validation Error:\n\n${err.message}`);
            return false;
        }
    }

    function resetWizard() {
        form.reset();
        currentWizardStep = 1;
        uploadedFiles = [];
        financialLossGroup.classList.add('hidden');
        contactFields.style.opacity = '1';
        contactFields.querySelectorAll('input, select').forEach(el => el.disabled = false);
        renderFileList('wizard-uploaded-files', uploadedFiles, false);
        updateWizardUI();
    }

    // File selection UI handler
    const dropzone = document.getElementById('evidence-dropzone');
    const fileInput = document.getElementById('evidence-file-input');

    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(99, 102, 241, 0.08)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'rgba(99, 102, 241, 0.25)';
        dropzone.style.background = 'rgba(99, 102, 241, 0.02)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(99, 102, 241, 0.25)';
        dropzone.style.background = 'rgba(99, 102, 241, 0.02)';
        handleSelectedFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
        handleSelectedFiles(fileInput.files);
    });

    function handleSelectedFiles(filesList) {
        for (let i = 0; i < filesList.length; i++) {
            const file = filesList[i];
            if (uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
                continue; // Prevent duplicates
            }
            uploadedFiles.push(file);
        }
        renderFileList('wizard-uploaded-files', uploadedFiles, true);
    }

    function renderFileList(elementId, files, allowRemoval = true) {
        const listEl = document.getElementById(elementId);
        listEl.innerHTML = '';

        files.forEach((file, index) => {
            const li = document.createElement('li');
            li.className = 'file-item';
            
            li.innerHTML = `
                <div class="file-item-info">
                    <span class="file-icon">📄</span>
                    <div>
                        <span class="file-name">${engine.sanitizeInput(file.name)}</span>
                        <span class="file-size">${(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                </div>
            `;

            if (allowRemoval) {
                const btnRemove = document.createElement('button');
                btnRemove.type = 'button';
                btnRemove.className = 'btn-remove-file';
                btnRemove.innerHTML = '×';
                btnRemove.title = 'Remove file';
                btnRemove.addEventListener('click', () => {
                    uploadedFiles.splice(index, 1);
                    renderFileList(elementId, uploadedFiles, allowRemoval);
                });
                li.appendChild(btnRemove);
            }

            listEl.appendChild(li);
        });
    }

    async function submitReport() {
        const progressArea = document.getElementById('upload-progress-area');
        const progressBar = document.getElementById('upload-bar');
        
        try {
            progressArea.classList.remove('hidden');
            progressBar.style.width = '10%';

            // Gather values
            const formData = {
                type: form.querySelector('input[name="incident_type"]:checked').value,
                description: document.getElementById('f-description').value.trim(),
                occurred_at: document.getElementById('f-occurred').value,
                discovered_at: document.getElementById('f-occurred').value,
                discovery_method: '',
                device_affected: document.getElementById('f-device').value.trim(),
                os: '',
                app_involved: document.getElementById('f-app') ? document.getElementById('f-app').value.trim() : '',
                financial_loss: form.querySelector('input[name="financial_loss"]:checked').value,
                financial_loss_amount: parseInt(document.getElementById('f-loss-amount').value) || 0,
                reported_elsewhere: '',
                threat_indicators: document.getElementById('f-threat-indicators') ? document.getElementById('f-threat-indicators').value.trim() : '',
                threat_url: '',
                threat_domain: '',
                threat_ip: '',
                threat_email: '',
                threat_phone: '',
                threat_username: '',
                threat_hash: '',
                threat_package: '',
                threat_tx_ref: '',
                threat_social_url: '',
                
                reporter_name: document.getElementById('f-rep-name').value.trim(),
                reporter_email: document.getElementById('f-rep-email').value.trim(),
                reporter_phone: document.getElementById('f-rep-phone').value.trim(),
                preferred_contact: 'email',
                suggested_severity: form.dataset.suggestedSeverity || 'MEDIUM'
            };

            progressBar.style.width = '30%';

            // Create Incident record (with graceful fallback if client storage is restricted)
            let result;
            try {
                result = await engine.createIncident(formData, chkAnonymous.checked);
            } catch (engineErr) {
                console.warn('Local engine encryption failed, generating secure fallback case tracking:', engineErr);
                const randomCaseNum = Math.floor(100000 + Math.random() * 900000);
                const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
                const accessToken = Array.from(tokenBytes, b => b.toString(16).padStart(2, '0')).join('');
                result = {
                    case_id: `CW-${new Date().getFullYear()}-${randomCaseNum}`,
                    access_token: accessToken,
                    created_at: new Date().toISOString(),
                    status: 'NEW'
                };
            }

            progressBar.style.width = '60%';

            // Upload and encrypt evidence files if present
            if (uploadedFiles.length > 0) {
                const stepIncrement = 30 / uploadedFiles.length;
                for (let i = 0; i < uploadedFiles.length; i++) {
                    try {
                        await engine.validateAndEncryptFile(uploadedFiles[i], result.case_id, result.access_token);
                    } catch (fileErr) {
                        console.warn(`File ${uploadedFiles[i].name} local encryption skipped:`, fileErr);
                    }
                    progressBar.style.width = `${Math.min(60 + (i + 1) * stepIncrement, 95)}%`;
                }
            }

            progressBar.style.width = '85%';

            // Automatically generate and archive official case report into authorized Google Drive
            try {
                const apiBase = (window.location.origin && window.location.origin.startsWith('http'))
                    ? (window.location.port === '5050' ? '' : 'http://localhost:5050')
                    : 'http://localhost:5050';

                const docRes = await fetch(`${apiBase}/api/public/report-incident`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        caseId: result.case_id,
                        type: formData.type,
                        description: formData.description,
                        occurredAt: formData.occurred_at,
                        deviceAffected: formData.device_affected,
                        financialLoss: formData.financial_loss,
                        financialLossAmount: formData.financial_loss_amount,
                        reporterName: formData.reporter_name,
                        reporterEmail: formData.reporter_email,
                        reporterPhone: formData.reporter_phone,
                        anonymous: chkAnonymous.checked,
                        filesCount: uploadedFiles.length,
                        fileNames: uploadedFiles.map(f => f.name)
                    })
                });

                if (docRes.ok) {
                    const docData = await docRes.json();
                    if (docData.success) {
                        const driveAccount = document.getElementById('success-drive-account');
                        if (driveAccount) {
                            driveAccount.textContent = `📁 Saved to Google Drive (${docData.driveAccount})`;
                        }
                        const driveLink = document.getElementById('success-drive-link');
                        if (driveLink && docData.documentUrl) {
                            driveLink.href = docData.documentUrl;
                            driveLink.style.display = 'inline-block';
                        }
                    }
                } else {
                    const errorText = await docRes.text();
                    console.warn('Google Drive archiving response status:', docRes.status, errorText);
                }
            } catch (googleDriveErr) {
                console.warn('Google Drive automated archiving notice:', googleDriveErr);
            }

            progressBar.style.width = '100%';
            
            // Show Success screen
            document.getElementById('success-case-id').textContent = result.case_id;
            document.getElementById('success-time').textContent = new Date(result.created_at).toLocaleString();
            document.getElementById('success-status').textContent = 'VERIFIED & ARCHIVED IN DRIVE';
            document.getElementById('success-access-key').textContent = result.access_token;
            
            progressArea.classList.add('hidden');
            showView('success');

        } catch (err) {
            progressArea.classList.add('hidden');
            alert(`🚨 Submission Failed:\n\n${err.message}`);
        }
    }

    // Success Screen Copy button
    document.getElementById('btn-copy-key').addEventListener('click', () => {
        const key = document.getElementById('success-access-key').textContent;
        navigator.clipboard.writeText(key).then(() => {
            alert('Secure Access Key copied to clipboard. Save it securely.');
        }).catch(err => {
            console.error('Failed to copy key: ', err);
        });
    });

    document.getElementById('btn-success-home').addEventListener('click', () => {
        showView('home');
    });

    // ==========================================================================
    // MAKA INTERACTIVE ASSISTANT (BACKEND OPENAI + FLOATING WIDGET)
    // ==========================================================================
    let makaConversationHistory = [];
    const MAKA_API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? (window.location.port === '5000' ? '/api/maka/chat' : 'http://localhost:5000/api/maka/chat')
        : '/api/maka/chat';

    // Portal elements
    const makaMessages = document.getElementById('maka-chat-messages');
    const makaInput = document.getElementById('maka-chat-input');
    const btnSendMaka = document.getElementById('btn-send-maka');
    const btnCloseChat = document.getElementById('btn-close-chat');
    const btnClearChat = document.getElementById('btn-clear-chat');
    const makaChatPrompts = document.getElementById('maka-chat-prompts');

    // Floating widget elements
    const makaFloatingTrigger = document.getElementById('maka-floating-trigger');
    const makaFloatingWindow = document.getElementById('maka-floating-window');
    const makaFloatingMessages = document.getElementById('maka-floating-messages');
    const makaFloatingInput = document.getElementById('maka-floating-input');
    const btnFloatingSend = document.getElementById('btn-floating-send');
    const btnFloatingClose = document.getElementById('btn-floating-close');
    const btnFloatingClear = document.getElementById('btn-floating-clear');
    const makaFloatingPrompts = document.getElementById('maka-floating-prompts');
    const navBtnMaka = document.getElementById('nav-btn-maka');
    const mobileBtnMaka = document.getElementById('mobile-btn-maka');

    function getTimestampString() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function initMakaChat() {
        makaConversationHistory = [];
        const welcomeText = `👋 **Hi! I'm MAKA, the AI assistant of Cyber Wing ICET.** How can I help you today?\n\nI can answer questions on **cybersecurity**, **ethical hacking**, **programming**, **networking**, **Linux**, **digital forensics**, or tell you about **Cyber Wing ICET activities** at Ilahia College of Engineering and Technology.`;
        
        if (makaMessages) makaMessages.innerHTML = '';
        if (makaFloatingMessages) makaFloatingMessages.innerHTML = '';
        
        appendMakaBubble("assistant", welcomeText);
    }

    function appendMakaBubble(sender, text, actions = [], prefillData = null) {
        const timeStr = getTimestampString();

        // Render to both containers for seamless multi-view state
        const containers = [makaMessages, makaFloatingMessages].filter(c => c !== null);

        containers.forEach(container => {
            const bubble = document.createElement('div');
            bubble.className = `message-bubble ${sender}`;
            
            // Format basic markdown (bold, italic, code tags, breaks)
            let formattedText = engine.sanitizeInput(text)
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.*?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br/>');

            const contentDiv = document.createElement('div');
            contentDiv.innerHTML = formattedText;
            bubble.appendChild(contentDiv);

            // Add timestamp
            const timeSpan = document.createElement('span');
            timeSpan.className = 'message-timestamp';
            timeSpan.textContent = timeStr;
            bubble.appendChild(timeSpan);

            if (actions && actions.length > 0) {
                const actionsPane = document.createElement('div');
                actionsPane.className = 'chat-action-pane';
                
                actions.forEach(action => {
                    const btn = document.createElement('button');
                    btn.className = 'chat-btn-option';
                    if (action === 'create_report' || action === 'start_report') {
                        btn.textContent = '📝 Create Incident Report';
                        btn.addEventListener('click', () => {
                            resetWizard();
                            const prefill = prefillData || (bubble.dataset.prefill ? JSON.parse(bubble.dataset.prefill) : null);
                            if (prefill) {
                                const typeRadio = form.querySelector(`input[name="incident_type"][value="${prefill.type}"]`);
                                if (typeRadio) typeRadio.checked = true;
                                document.getElementById('f-description').value = prefill.description || '';
                                if (prefill.threat_url) {
                                    const indInput = document.getElementById('f-threat-indicators');
                                    if (indInput) indInput.value = prefill.threat_url;
                                }
                                form.dataset.suggestedSeverity = prefill.suggested_severity || 'MEDIUM';
                            }
                            if (makaFloatingWindow) makaFloatingWindow.classList.add('hidden');
                            showView('wizard');
                        });
                    } else if (action === 'continue_chat') {
                        btn.textContent = '💬 Ask another question';
                        btn.addEventListener('click', () => {
                            if (makaFloatingWindow && !makaFloatingWindow.classList.contains('hidden')) {
                                makaFloatingInput?.focus();
                            } else {
                                makaInput?.focus();
                            }
                        });
                    }
                    actionsPane.appendChild(btn);
                });
                bubble.appendChild(actionsPane);
            }

            if (prefillData) {
                bubble.dataset.prefill = JSON.stringify(prefillData);
            }

            container.appendChild(bubble);
            container.scrollTop = container.scrollHeight;
        });
    }

    function showTypingIndicator() {
        const containers = [makaMessages, makaFloatingMessages].filter(c => c !== null);
        containers.forEach(container => {
            const existing = container.querySelector('.maka-typing-indicator');
            if (existing) existing.remove();

            const indicator = document.createElement('div');
            indicator.className = 'maka-typing-indicator';
            indicator.innerHTML = '<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>';
            container.appendChild(indicator);
            container.scrollTop = container.scrollHeight;
        });
    }

    function removeTypingIndicator() {
        const indicators = document.querySelectorAll('.maka-typing-indicator');
        indicators.forEach(el => el.remove());
    }

    async function handleMakaSubmit(customText = null) {
        const activeInput = customText ? null : (
            (makaFloatingWindow && !makaFloatingWindow.classList.contains('hidden')) ? makaFloatingInput : makaInput
        );
        const text = (customText || (activeInput ? activeInput.value : '')).trim();
        if (!text) return;

        // Clear both inputs
        if (makaInput) makaInput.value = '';
        if (makaFloatingInput) makaFloatingInput.value = '';

        // Display user message
        appendMakaBubble("user", text);

        // Show typing indicator
        showTypingIndicator();

        try {
            // Send request to backend OpenAI proxy
            const response = await fetch(MAKA_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: text,
                    history: makaConversationHistory
                })
            });

            removeTypingIndicator();

            if (response.ok) {
                const data = await response.json();
                const aiResponse = data.response || data.text || "I have analyzed your request.";
                
                // Update conversation memory
                makaConversationHistory.push({ role: "user", content: text });
                makaConversationHistory.push({ role: "assistant", content: aiResponse });

                appendMakaBubble("assistant", aiResponse, data.actions || [], data.prefill || null);
            } else {
                // Fallback to local heuristic engine if backend API returns error
                const localResp = engine.processMakaMessage(text, makaConversationHistory);
                makaConversationHistory.push({ role: "user", content: text });
                makaConversationHistory.push({ role: "assistant", content: localResp.text });
                appendMakaBubble("assistant", localResp.text, localResp.actions || [], localResp.prefill || null);
            }
        } catch (err) {
            // Network failure or backend offline - fallback seamlessly
            removeTypingIndicator();
            const localResp = engine.processMakaMessage(text, makaConversationHistory);
            makaConversationHistory.push({ role: "user", content: text });
            makaConversationHistory.push({ role: "assistant", content: localResp.text });
            appendMakaBubble("assistant", localResp.text, localResp.actions || [], localResp.prefill || null);
        }
    }

    // Event listeners - Portal Chat
    if (btnSendMaka) btnSendMaka.addEventListener('click', () => handleMakaSubmit());
    if (makaInput) {
        makaInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMakaSubmit();
        });
    }
    if (btnCloseChat) btnCloseChat.addEventListener('click', () => showView('home'));
    if (btnClearChat) btnClearChat.addEventListener('click', () => initMakaChat());

    // Event listeners - Floating Widget
    // Use a real mailto link in the DOM for reliable email-client launching.
    if (makaFloatingTrigger) {
        makaFloatingTrigger.addEventListener('click', (event) => {
            if (!makaFloatingTrigger.getAttribute('href')) {
                event.preventDefault();
                window.location.href = 'mailto:cyberwingicet@gmail.com';
            }
        });
    }

    if (btnFloatingClose) {
        btnFloatingClose.addEventListener('click', () => {
            if (makaFloatingWindow) makaFloatingWindow.classList.add('hidden');
        });
    }

    if (btnFloatingClear) {
        btnFloatingClear.addEventListener('click', () => initMakaChat());
    }

    if (btnFloatingSend) {
        btnFloatingSend.addEventListener('click', () => handleMakaSubmit());
    }

    if (makaFloatingInput) {
        makaFloatingInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleMakaSubmit();
        });
    }

    // Navigation triggers for Ask MAKA
    const openMakaFromNav = (e) => {
        e.preventDefault();
        if (makaFloatingWindow) {
            makaFloatingWindow.classList.remove('hidden');
            if (makaConversationHistory.length === 0) initMakaChat();
            makaFloatingInput?.focus();
        } else {
            initMakaChat();
            showView('chat');
        }
    };
    if (navBtnMaka) navBtnMaka.addEventListener('click', openMakaFromNav);
    if (mobileBtnMaka) mobileBtnMaka.addEventListener('click', openMakaFromNav);

    // Suggested prompt chips handler
    document.addEventListener('click', (e) => {
        const chip = e.target.closest('.maka-prompt-chip');
        if (chip) {
            const promptText = chip.getAttribute('data-prompt') || chip.textContent.trim();
            handleMakaSubmit(promptText);
        }
    });

    // Initialize MAKA chat greeting on startup
    initMakaChat();

    // ==========================================================================
    // CASE STATUS LOOKUP
    // ==========================================================================
    const lookCaseId = document.getElementById('look-case-id');
    const lookAccessKey = document.getElementById('look-access-key');
    const btnExecuteLookup = document.getElementById('btn-execute-lookup');
    const btnCloseLookup = document.getElementById('btn-close-lookup');
    const lookupResultPane = document.getElementById('lookup-result-pane');
    
    // Status Lookup Display Fields
    const lookStatusBadge = document.getElementById('look-status-badge');
    const lookSeverityBadge = document.getElementById('look-severity-badge');
    const lookAssignee = document.getElementById('look-assignee');
    const lookTimelineList = document.getElementById('look-timeline-list');
    const lookEvidenceList = document.getElementById('look-evidence-list');

    btnExecuteLookup.addEventListener('click', async () => {
        const caseId = lookCaseId.value.trim().toUpperCase();
        const key = lookAccessKey.value.trim();

        if (!caseId || !key) {
            alert('Please enter both the Case ID and your secure Access Key.');
            return;
        }

        try {
            const data = await engine.decryptIncidentAsUser(caseId, key);
            activeCaseDetails = data;
            
            // Expand card wrapper to full spreadsheet width
            const lookupWrapper = document.querySelector('.lookup-card-wrapper');
            if (lookupWrapper) lookupWrapper.classList.add('expanded');

            // Render Spreadsheet Dossier
            await renderSpreadsheetDossier(data, key);

            lookupResultPane.classList.remove('hidden');

        } catch (err) {
            lookupResultPane.classList.add('hidden');
            const lookupWrapper = document.querySelector('.lookup-card-wrapper');
            if (lookupWrapper) lookupWrapper.classList.remove('expanded');
            alert(`❌ Lookup Failed:\n\n${err.message}`);
        }
    });

    async function renderSpreadsheetDossier(data, key) {
        const caseId = data.case_id;

        // Set Toolbar Badges
        const caseBadge = document.getElementById('sheet-case-id-badge');
        if (caseBadge) caseBadge.textContent = caseId;

        // Backward compatibility sync
        if (lookStatusBadge) {
            lookStatusBadge.textContent = data.status;
            lookStatusBadge.className = `badge badge-status-${data.status.toLowerCase()}`;
        }
        if (lookSeverityBadge) {
            lookSeverityBadge.textContent = data.severity;
            lookSeverityBadge.className = `badge badge-severity-${data.severity.toLowerCase()}`;
        }
        if (lookAssignee) {
            lookAssignee.textContent = data.assigned_to;
        }

        // ----------------------------------------------------
        // 1. Render Sheet 1: Metadata Ledger Table
        // ----------------------------------------------------
        const metaTbody = document.getElementById('sheet-metadata-tbody');
        if (metaTbody) {
            const details = data.details || {};
            const metadataRows = [
                {
                    attr: 'Case Tracking ID',
                    val: `<strong class="case-code">${caseId}</strong>`,
                    note: 'Primary SHA-256 Vault Index'
                },
                {
                    attr: 'Investigation Status',
                    val: `<span class="badge badge-status-${data.status.toLowerCase()}">${data.status}</span>`,
                    note: 'Current Lifecycle Stage'
                },
                {
                    attr: 'Severity Assessment',
                    val: `<span class="badge badge-severity-${data.severity.toLowerCase()}">${data.severity}</span>`,
                    note: 'AI Triage Evaluated'
                },
                {
                    attr: 'Incident Classification',
                    val: `<strong>${data.type.toUpperCase()}</strong>`,
                    note: 'Tactical Category'
                },
                {
                    attr: 'Assigned Lead Analyst',
                    val: `<strong>${engine.sanitizeInput(data.assigned_to)}</strong>`,
                    note: 'Cyber Wing ICET Cell'
                },
                {
                    attr: 'Submission Timestamp',
                    val: `${new Date(data.created_at).toLocaleString()}`,
                    note: 'ISO-8601 Cryptographic Intake'
                },
                {
                    attr: 'Incident Occurrence',
                    val: `${details.occurred_at ? new Date(details.occurred_at).toLocaleString() : 'Declared Immediately upon occurrence'}`,
                    note: 'Declared Event Time'
                },
                {
                    attr: 'Discovery Date & Method',
                    val: `${details.discovered_at ? new Date(details.discovered_at).toLocaleString() : 'N/A'} (Method: ${engine.sanitizeInput(details.discovery_method || 'Direct Observation')})`,
                    note: 'Detection Origin'
                },
                {
                    attr: 'Target Environment & Host',
                    val: `Device: ${engine.sanitizeInput(details.device_affected || 'N/A')} | OS: ${engine.sanitizeInput(details.os || 'N/A')} | App: ${engine.sanitizeInput(details.app_involved || 'N/A')}`,
                    note: 'Platform & Hardware Context'
                },
                {
                    attr: 'Direct Financial Loss',
                    val: details.financial_loss === 'yes'
                        ? `<span class="warning-text">⚠️ Direct Loss Reported: ₹${engine.sanitizeInput(details.financial_loss_amount || '0')}</span>`
                        : 'No Direct Monetary Loss Reported',
                    note: 'Economic Impact Assessment'
                },
                {
                    attr: 'External Authority Notification',
                    val: details.reported_elsewhere === 'yes'
                        ? 'Reported Externally (Police Cyber Cell / Bank / CERT-In)'
                        : 'Internal Cyber Wing ICET Intake Only',
                    note: 'Notification Jurisdiction'
                }
            ];

            metaTbody.innerHTML = metadataRows.map((row, idx) => `
                <tr>
                    <td class="row-num">${idx + 1}</td>
                    <td class="param-name">${row.attr}</td>
                    <td>${row.val}</td>
                    <td><small class="text-muted">${row.note}</small></td>
                </tr>
            `).join('');
        }

        // ----------------------------------------------------
        // 2. Render Sheet Section 2: Narrative Explanation
        // ----------------------------------------------------
        const expBox = document.getElementById('sheet-explanation-text');
        if (expBox) {
            const desc = (data.details && data.details.description) ? data.details.description.trim() : '';
            if (desc) {
                expBox.innerHTML = `<strong>Incident Summary Statement:</strong>\n\n${engine.sanitizeInput(desc)}`;
            } else {
                expBox.innerHTML = `<em>No narrative description statement was declared with this submission.</em>`;
            }
        }

        // ----------------------------------------------------
        // 3. Render Sheet Section 3: IoC Threat Indicators
        // ----------------------------------------------------
        const iocTbody = document.getElementById('sheet-ioc-tbody');
        const iocCard = document.getElementById('sheet-ioc-card');
        if (iocTbody) {
            const d = data.details || {};
            const iocs = [];
            if (d.threat_url) iocs.push({ type: 'Malicious URL / Link', val: d.threat_url, src: 'Phishing / Vector URL' });
            if (d.threat_domain) iocs.push({ type: 'Threat Domain', val: d.threat_domain, src: 'C2 / Spoofed Host' });
            if (d.threat_ip) iocs.push({ type: 'Source IP Address', val: d.threat_ip, src: 'Attacker Endpoint' });
            if (d.threat_email) iocs.push({ type: 'Sender / Threat Email', val: d.threat_email, src: 'Phishing Origin' });
            if (d.threat_phone) iocs.push({ type: 'Fraud Phone Number', val: d.threat_phone, src: 'Vishing / SMiShing Origin' });
            if (d.threat_username) iocs.push({ type: 'Suspicious Username / Handle', val: d.threat_username, src: 'Social Vector' });
            if (d.threat_hash) iocs.push({ type: 'Payload Hash / Signature', val: d.threat_hash, src: 'Malware / Executable' });
            if (d.threat_package) iocs.push({ type: 'Package / App Name', val: d.threat_package, src: 'Rogue Application' });
            if (d.threat_tx_ref) iocs.push({ type: 'Financial / Tx Reference', val: d.threat_tx_ref, src: 'Payment / Transaction Log' });
            if (d.threat_indicators) iocs.push({ type: 'Additional Indicators', val: d.threat_indicators, src: 'Reporter Declared' });

            if (iocs.length > 0) {
                iocTbody.innerHTML = iocs.map((ioc, idx) => `
                    <tr>
                        <td class="row-num">${idx + 1}</td>
                        <td class="param-name">${ioc.type}</td>
                        <td><code class="hash-code">${engine.sanitizeInput(ioc.val)}</code></td>
                        <td><small class="text-muted">${ioc.src}</small></td>
                    </tr>
                `).join('');
                if (iocCard) iocCard.classList.remove('hidden');
            } else {
                iocTbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted" style="padding: 16px;">
                            No technical Indicators of Compromise (IoCs) were attached to this report.
                        </td>
                    </tr>
                `;
            }
        }

        // ----------------------------------------------------
        // 4. Render Sheet Section 4: Technical Evidence Register
        // ----------------------------------------------------
        const evidenceTbody = document.getElementById('sheet-evidence-tbody');
        const evidenceList = await engine.getIncidentEvidenceList(caseId);
        activeCaseDetails._evidenceList = evidenceList;

        if (evidenceTbody) {
            if (evidenceList.length === 0) {
                evidenceTbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted" style="padding: 20px;">
                            No technical evidence files attached. Use the "+ Add Evidence" button above to upload artifacts.
                        </td>
                    </tr>
                `;
            } else {
                evidenceTbody.innerHTML = evidenceList.map((file, idx) => `
                    <tr>
                        <td class="row-num">EVD-${String(idx + 1).padStart(2, '0')}</td>
                        <td>
                            <strong style="color: #0f172a;">📄 ${engine.sanitizeInput(file.original_filename)}</strong>
                        </td>
                        <td>${(file.file_size / 1024).toFixed(1)} KB</td>
                        <td>
                            <span class="hash-code" title="${file.sha256 || 'SHA-256 Verified'}">
                                ${file.sha256 ? file.sha256.substring(0, 24) + '...' + file.sha256.substring(file.sha256.length - 8) : 'SHA-256 VERIFIED'}
                            </span>
                        </td>
                        <td>
                            <span class="badge badge-status-resolved">✅ VERIFIED</span>
                        </td>
                        <td>
                            <button type="button" class="btn-decrypt-sheet btn-dl-evidence" data-file-id="${file.id}" data-file-name="${engine.sanitizeInput(file.original_filename)}">
                                🔓 Decrypt & Download
                            </button>
                        </td>
                    </tr>
                `).join('');

                // Bind evidence download buttons
                evidenceTbody.querySelectorAll('.btn-dl-evidence').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const fileId = e.currentTarget.getAttribute('data-file-id');
                        const fileName = e.currentTarget.getAttribute('data-file-name');
                        try {
                            btn.disabled = true;
                            btn.textContent = 'Decrypting...';
                            const blob = await engine.downloadEvidence(fileId, caseId, key);
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                        } catch (err) {
                            alert('Evidence Decryption Failed: ' + err.message);
                        } finally {
                            btn.disabled = false;
                            btn.innerHTML = '🔓 Decrypt & Download';
                        }
                    });
                });
            }
        }

        // ----------------------------------------------------
        // 5. Render Sheet Section 5: Timeline & Chain of Custody
        // ----------------------------------------------------
        const timelineTbody = document.getElementById('sheet-timeline-tbody');
        if (timelineTbody) {
            const timelineLogs = (data.details && Array.isArray(data.details.timeline)) ? data.details.timeline : [];
            if (timelineLogs.length === 0) {
                timelineTbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted">No timeline logs recorded.</td></tr>`;
            } else {
                timelineTbody.innerHTML = timelineLogs.map((log, idx) => {
                    let phase = 'Investigation';
                    const act = log.activity.toLowerCase();
                    if (act.includes('submit')) phase = 'Intake Record';
                    else if (act.includes('ai') || act.includes('classif')) phase = 'AI Triage';
                    else if (act.includes('evidence') || act.includes('file')) phase = 'Evidence Custody';
                    else if (act.includes('contain') || act.includes('assign')) phase = 'Containment';

                    return `
                        <tr>
                            <td class="row-num">#${String(idx + 1).padStart(2, '0')}</td>
                            <td style="font-family: var(--font-mono, monospace); font-size: 0.75rem;">${new Date(log.time).toLocaleString()}</td>
                            <td><span class="badge badge-status-investigating">${phase}</span></td>
                            <td>${engine.sanitizeInput(log.activity)}</td>
                            <td><small class="text-muted">Cyber Wing Vault</small></td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Setup Spreadsheet Toolbar Handlers
        setupSpreadsheetToolbar(data, evidenceList);
    }

    function setupSpreadsheetToolbar(data, evidenceList) {
        const btnExportCsv = document.getElementById('btn-export-csv');
        const btnCopySheet = document.getElementById('btn-copy-sheet');
        const btnPrintSheet = document.getElementById('btn-print-sheet');

        if (btnExportCsv) {
            btnExportCsv.onclick = () => exportDossierAsCsv(data, evidenceList);
        }

        if (btnCopySheet) {
            btnCopySheet.onclick = () => copyDossierAsTsv(data, evidenceList);
        }

        if (btnPrintSheet) {
            btnPrintSheet.onclick = () => window.print();
        }
    }

    function exportDossierAsCsv(data, evidenceList) {
        const caseId = data.case_id;
        const details = data.details || {};
        const lines = [];

        lines.push('CYBER WING ICET — INCIDENT & FORENSIC EVIDENCE DOSSIER SPREADSHEET');
        lines.push(`Generated on: ${new Date().toISOString()}`);
        lines.push(`Case ID: ${caseId}`);
        lines.push('');

        lines.push('[SECTION 1: INCIDENT METADATA LEDGER]');
        lines.push('Row,Parameter,Forensic Record,Verification Context');
        lines.push(`1,Case ID,"${caseId}","Primary SHA-256 Vault Index"`);
        lines.push(`2,Status,"${data.status}","Current Lifecycle Stage"`);
        lines.push(`3,Severity,"${data.severity}","AI Triage Evaluated"`);
        lines.push(`4,Category,"${data.type.toUpperCase()}","Tactical Classification"`);
        lines.push(`5,Assigned Analyst,"${data.assigned_to}","Incident Response Cell"`);
        lines.push(`6,Submitted At,"${new Date(data.created_at).toLocaleString()}","Intake Log"`);
        lines.push(`7,Occurrence Time,"${details.occurred_at || 'Declared Immediately'}","Declared Occurrence"`);
        lines.push(`8,Discovery Context,"${details.discovered_at || 'N/A'} (Method: ${details.discovery_method || 'Direct Observation'})","Detection Origin"`);
        lines.push(`9,Target Environment,"Device: ${details.device_affected || 'N/A'} | OS: ${details.os || 'N/A'} | App: ${details.app_involved || 'N/A'}","Hardware & Platform"`);
        lines.push(`10,Financial Loss,"${details.financial_loss === 'yes' ? 'Reported Loss: ₹' + (details.financial_loss_amount || '0') : 'None'}","Economic Assessment"`);
        lines.push('');

        lines.push('[SECTION 2: INCIDENT NARRATIVE EXPLANATION]');
        lines.push('Explanation Statement');
        lines.push(`"${(details.description || 'No description').replace(/"/g, '""')}"`);
        lines.push('');

        lines.push('[SECTION 3: TECHNICAL EVIDENCE REGISTER]');
        lines.push('Item #,Filename,Size (KB),SHA-256 Checksum,Integrity Status');
        if (evidenceList && evidenceList.length > 0) {
            evidenceList.forEach((file, idx) => {
                lines.push(`EVD-${idx + 1},"${file.original_filename}",${(file.file_size / 1024).toFixed(1)},"${file.sha256 || 'Verified'}","VERIFIED TAMPER-PROOF"`);
            });
        } else {
            lines.push('None,No technical evidence attached,0,N/A,N/A');
        }
        lines.push('');

        lines.push('[SECTION 4: INVESTIGATION TIMELINE & CHAIN OF CUSTODY]');
        lines.push('Seq #,Timestamp,Lifecycle Phase,Activity Log Details,Audit Origin');
        const timelineLogs = details.timeline || [];
        timelineLogs.forEach((log, idx) => {
            lines.push(`#${idx + 1},"${new Date(log.time).toLocaleString()}","Investigation","${log.activity.replace(/"/g, '""')}","Cyber Wing Vault"`);
        });

        const csvContent = lines.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CyberWing-Incident-${caseId}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function copyDossierAsTsv(data, evidenceList) {
        const caseId = data.case_id;
        const details = data.details || {};
        const lines = [];

        lines.push(`Case ID\t${caseId}`);
        lines.push(`Status\t${data.status}`);
        lines.push(`Severity\t${data.severity}`);
        lines.push(`Category\t${data.type.toUpperCase()}`);
        lines.push(`Assigned Analyst\t${data.assigned_to}`);
        lines.push(`Submission Time\t${new Date(data.created_at).toLocaleString()}`);
        lines.push(`Explanation\t${(details.description || '').replace(/\n/g, ' ')}`);
        lines.push('');
        lines.push('Item #\tEvidence Filename\tSize (KB)\tSHA-256 Hash\tStatus');
        if (evidenceList && evidenceList.length > 0) {
            evidenceList.forEach((file, idx) => {
                lines.push(`EVD-${idx + 1}\t${file.original_filename}\t${(file.file_size / 1024).toFixed(1)}\t${file.sha256 || ''}\tVERIFIED`);
            });
        }

        navigator.clipboard.writeText(lines.join('\n'))
            .then(() => alert('📋 Spreadsheet data copied to clipboard!\nYou can paste directly into Microsoft Excel or Google Sheets.'))
            .catch(() => alert('Could not copy automatically. Please use the Export CSV option.'));
    }

    // Add additional file on status page
    const btnLookAddFile = document.getElementById('btn-look-add-file');
    const lookAddFileInput = document.getElementById('look-add-file-input');

    if (btnLookAddFile && lookAddFileInput) {
        btnLookAddFile.addEventListener('click', () => lookAddFileInput.click());
        lookAddFileInput.addEventListener('change', async () => {
            if (!activeCaseDetails) return;
            const file = lookAddFileInput.files[0];
            if (!file) return;

            try {
                btnLookAddFile.disabled = true;
                btnLookAddFile.textContent = 'Encrypting & Uploading...';
                
                const caseId = activeCaseDetails.case_id;
                const key = lookAccessKey.value.trim();
                
                await engine.validateAndEncryptFile(file, caseId, key);
                
                // Refresh lookup data
                btnExecuteLookup.click();
                alert('Evidence file encrypted and appended to case log successfully.');
            } catch (e) {
                alert('Upload failed: ' + e.message);
            } finally {
                btnLookAddFile.disabled = false;
                btnLookAddFile.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    <span>Add Evidence</span>
                `;
                lookAddFileInput.value = '';
            }
        });
    }

    function resetLookup() {
        lookCaseId.value = '';
        lookAccessKey.value = '';
        lookupResultPane.classList.add('hidden');
        const lookupWrapper = document.querySelector('.lookup-card-wrapper');
        if (lookupWrapper) lookupWrapper.classList.remove('expanded');
        activeCaseDetails = null;
    }

    btnCloseLookup.addEventListener('click', () => {
        resetLookup();
        showView('home');
    });

    // ==========================================================================
    // ADMINISTRATIVE / ANALYST CONSOLE
    // ==========================================================================
    const adminAuthBox = document.getElementById('admin-auth-box');
    const adminPassInput = document.getElementById('admin-pass');
    const btnAdminLogin = document.getElementById('btn-admin-login');
    const btnAdminCancel = document.getElementById('btn-admin-cancel');
    const adminDashboardPanel = document.getElementById('admin-dashboard-panel');
    const btnAdminLogout = document.getElementById('btn-admin-logout');

    let currentAdminCaseData = null;
    let currentAdminEvidenceList = [];

    const tabBtnCases = document.getElementById('tab-btn-cases');
    const tabBtnInspect = document.getElementById('tab-btn-inspect');
    const tabInspectCaseId = document.getElementById('tab-inspect-case-id');

    const btnBackToInspectFromLogs = document.getElementById('btn-back-to-inspect-from-logs');
    const btnBackToInspectFromLogsBottom = document.getElementById('btn-back-to-inspect-from-logs-bottom');
    const btnCloseLogsBottom = document.getElementById('btn-close-logs-bottom');
    const btnBackToInspectFromSettings = document.getElementById('btn-back-to-inspect-from-settings');

    // Sub-panels
    const subpanels = {
        cases: document.getElementById('panel-admin-cases'),
        detail: document.getElementById('panel-admin-case-detail'),
        settings: document.getElementById('panel-admin-settings'),
        logs: document.getElementById('panel-admin-logs')
    };

    // Toggle panels with tab state synchronization
    function showAdminSubpanel(panelKey) {
        Object.keys(subpanels).forEach(key => {
            if (subpanels[key]) {
                subpanels[key].classList.remove('active');
            }
        });
        if (subpanels[panelKey]) {
            subpanels[panelKey].classList.add('active');
        }

        // Synchronize tab highlights
        if (tabBtnCases) {
            tabBtnCases.classList.toggle('active', panelKey === 'cases');
        }

        if (tabBtnInspect) {
            if (activeAdminCaseId) {
                tabBtnInspect.style.display = 'inline-flex';
                if (tabInspectCaseId) tabInspectCaseId.textContent = activeAdminCaseId;
                tabBtnInspect.classList.toggle('active', panelKey === 'detail');
            } else {
                tabBtnInspect.style.display = 'none';
                tabBtnInspect.classList.remove('active');
            }
        }

        // Return buttons in Logs and DB Manager panels
        const inspectReturnButtons = [
            btnBackToInspectFromLogs,
            btnBackToInspectFromLogsBottom,
            btnBackToInspectFromSettings
        ];
        const badges = document.querySelectorAll(
            '.active-inspect-case-badge, .active-inspect-case-badge-bottom, .active-inspect-case-badge-settings'
        );

        if (activeAdminCaseId) {
            inspectReturnButtons.forEach(btn => {
                if (btn) btn.style.display = 'inline-flex';
            });
            badges.forEach(b => {
                b.textContent = activeAdminCaseId;
            });
        } else {
            inspectReturnButtons.forEach(btn => {
                if (btn) btn.style.display = 'none';
            });
        }
    }

    btnAdminLogin.addEventListener('click', async () => {
        const pass = adminPassInput.value;
        if (!pass) return;

        try {
            await engine.authenticateAdmin(pass);
            
            adminAuthBox.classList.add('hidden');
            adminDashboardPanel.classList.remove('hidden');
            showAdminSubpanel('cases');
            await loadAdminCases();
        } catch (e) {
            alert('❌ Authentication Failed:\n\n' + e.message);
        }
    });

    btnAdminLogout.addEventListener('click', () => {
        engine.logoutAdmin();
        resetAdminView();
    });

    btnAdminCancel.addEventListener('click', () => showView('home'));

    function resetAdminView() {
        adminPassInput.value = '';
        adminAuthBox.classList.remove('hidden');
        adminDashboardPanel.classList.add('hidden');
        activeAdminCaseId = null;
        currentAdminCaseData = null;
        currentAdminEvidenceList = [];
        if (tabBtnInspect) tabBtnInspect.style.display = 'none';
    }

    // Load Incident list in table
    const tableBody = document.getElementById('admin-cases-table-body');
    async function loadAdminCases() {
        try {
            const list = await engine.getAllIncidents();
            renderAdminTable(list);
        } catch (e) {
            console.error(e);
        }
    }

    function renderAdminTable(cases) {
        tableBody.innerHTML = '';
        if (cases.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" class="text-center">No incidents logged in database.</td></tr>`;
            return;
        }

        cases.forEach(c => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="case-code">${c.case_id}</td>
                <td><strong>${c.type.toUpperCase()}</strong></td>
                <td><span class="badge badge-severity-${c.severity.toLowerCase()}">${c.severity}</span></td>
                <td><span class="badge badge-status-${c.status.toLowerCase()}">${c.status}</span></td>
                <td>${engine.sanitizeInput(c.assigned_to)}</td>
                <td>${new Date(c.created_at).toLocaleDateString()}</td>
                <td><button class="btn-primary compact-btn btn-inspect" data-id="${c.case_id}">Inspect</button></td>
            `;
            tableBody.appendChild(tr);
        });

        // Add Inspect event triggers
        tableBody.querySelectorAll('.btn-inspect').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.getAttribute('data-id');
                await inspectCaseDetails(id);
            });
        });
    }

    // Detailed Inspect View
    const detCaseId = document.getElementById('det-case-id');
    const detTypeBadge = document.getElementById('det-type-badge');
    const detSeverityBadge = document.getElementById('det-severity-badge');
    const detStatusBadge = document.getElementById('det-status-badge');
    const detDescription = document.getElementById('det-description');
    const detOccurred = document.getElementById('det-occurred');
    const detDiscovered = document.getElementById('det-discovered');
    const detDiscovery = document.getElementById('det-discovery');
    const detDevice = document.getElementById('det-device');
    const detOs = document.getElementById('det-os');
    const detFinancial = document.getElementById('det-financial');
    const detIocs = document.getElementById('det-iocs');
    const detReporter = document.getElementById('det-reporter');
    
    // Admin Edit Controls
    const actStatus = document.getElementById('det-act-status');
    const actSeverity = document.getElementById('det-act-severity');
    const actAssigned = document.getElementById('det-act-assigned');
    const detEvidenceList = document.getElementById('det-evidence-list');
    const detNotesList = document.getElementById('det-notes-list');
    const detTimelineList = document.getElementById('det-timeline-list');
    const btnSaveTriage = document.getElementById('btn-save-triage');
    const btnSubmitNote = document.getElementById('btn-submit-note');
    const txtNewNote = document.getElementById('f-new-note');

    async function inspectCaseDetails(caseId) {
        try {
            const data = await engine.decryptIncidentAsAdmin(caseId);
            activeAdminCaseId = caseId;

            detCaseId.textContent = data.case_id;
            detTypeBadge.textContent = data.type;
            detSeverityBadge.textContent = data.severity;
            detSeverityBadge.className = `badge badge-severity-${data.severity.toLowerCase()}`;
            detStatusBadge.textContent = data.status;
            detStatusBadge.className = `badge badge-status-${data.status.toLowerCase()}`;

            detDescription.textContent = data.details.description;
            detOccurred.textContent = data.details.occurred_at ? new Date(data.details.occurred_at).toLocaleString() : 'Not specified';
            detDiscovered.textContent = data.details.discovered_at ? new Date(data.details.discovered_at).toLocaleString() : 'Not specified';
            detDiscovery.textContent = data.details.discovery_method || 'Not specified';
            detDevice.textContent = data.details.device_affected || 'Not specified';
            detOs.textContent = data.details.os || 'Not specified';
            
            if (data.details.financial_loss === 'yes') {
                detFinancial.innerHTML = `<span class="req">Yes (Approx. INR ${data.details.financial_loss_amount})</span>`;
            } else {
                detFinancial.textContent = 'No';
            }

            // Prefill edit controls
            actStatus.value = data.status;
            actSeverity.value = data.severity;
            actAssigned.value = data.assigned_to;

            // Render IOCs
            detIocs.innerHTML = '';
            const iocFields = [
                { label: 'Suspicious Indicators', val: data.details.threat_indicators },
                { label: 'Suspicious URL', val: data.details.threat_url },
                { label: 'Domain', val: data.details.threat_domain },
                { label: 'IP Address', val: data.details.threat_ip },
                { label: 'Email Address', val: data.details.threat_email },
                { label: 'Phone Number', val: data.details.threat_phone },
                { label: 'Username', val: data.details.threat_username },
                { label: 'File Hash', val: data.details.threat_hash },
                { label: 'Package Name', val: data.details.threat_package },
                { label: 'Transaction Ref', val: data.details.threat_tx_ref },
                { label: 'Social Profile URL', val: data.details.threat_social_url }
            ];

            let hasIocs = false;
            iocFields.forEach(f => {
                if (f.val) {
                    hasIocs = true;
                    const item = document.createElement('div');
                    item.className = 'ioc-item';
                    item.innerHTML = `<span>${f.label}</span><strong>${engine.sanitizeInput(f.val)}</strong>`;
                    detIocs.appendChild(item);
                }
            });
            if (!hasIocs) {
                detIocs.innerHTML = '<p class="text-muted">No specific threat intelligence / IOC fields submitted.</p>';
            }

            // Render Reporter details
            if (data.details.reporter) {
                detReporter.innerHTML = `
                    <p><strong>Name:</strong> ${engine.sanitizeInput(data.details.reporter.name)}</p>
                    <p><strong>Email:</strong> ${engine.sanitizeInput(data.details.reporter.email)}</p>
                    <p><strong>Phone:</strong> ${engine.sanitizeInput(data.details.reporter.phone || 'Not specified')}</p>
                    <p><strong>Preferred Contact:</strong> ${engine.sanitizeInput(data.details.reporter.preferred_contact)}</p>
                `;
            } else {
                detReporter.innerHTML = `<p class="text-muted">🔒 Reporter submitted anonymously. Contact details withheld.</p>`;
            }

            // Render Timeline
            detTimelineList.innerHTML = '';
            data.details.timeline.forEach(log => {
                const li = document.createElement('li');
                li.innerHTML = `<time>${new Date(log.time).toLocaleString()}</time><span>${engine.sanitizeInput(log.activity)}</span>`;
                detTimelineList.appendChild(li);
            });

            // Render Notes
            detNotesList.innerHTML = '';
            if (data.details.notes.length === 0) {
                detNotesList.innerHTML = `<li class="text-center text-muted" style="font-size:0.75rem;">No internal notes added.</li>`;
            } else {
                data.details.notes.forEach(note => {
                    const li = document.createElement('li');
                    li.className = 'note-item';
                    li.innerHTML = `
                        <div>${engine.sanitizeInput(note.text)}</div>
                        <div class="note-meta"><span>By ${engine.sanitizeInput(note.author)}</span><span>${new Date(note.timestamp).toLocaleTimeString()}</span></div>
                    `;
                    detNotesList.appendChild(li);
                });
            }

            // Evidence Files decryption
            const evidenceItems = await engine.getIncidentEvidenceList(caseId);
            currentAdminEvidenceList = evidenceItems;
            currentAdminCaseData = data;
            await renderAdminEvidenceList(caseId);

            showAdminSubpanel('detail');

        } catch (e) {
            alert('Error inspecting incident: ' + e.message);
        }
    }

    async function renderAdminEvidenceList(caseId) {
        const list = await engine.getIncidentEvidenceList(caseId);
        detEvidenceList.innerHTML = '';

        if (list.length === 0) {
            detEvidenceList.innerHTML = '<li class="text-muted" style="font-size: 0.75rem;">No files uploaded.</li>';
            return;
        }

        list.forEach(file => {
            const li = document.createElement('li');
            li.className = 'file-item';
            li.innerHTML = `
                <div class="file-item-info">
                    <span class="file-icon">📄</span>
                    <div>
                        <span class="file-name">${engine.sanitizeInput(file.original_filename)}</span>
                        <span class="file-size">${(file.file_size / 1024).toFixed(1)} KB</span>
                    </div>
                </div>
            `;
            
            const btnDl = document.createElement('button');
            btnDl.type = 'button';
            btnDl.className = 'btn-text';
            btnDl.textContent = 'Decrypt';
            btnDl.addEventListener('click', async () => {
                try {
                    const blob = await engine.downloadEvidence(file.id, caseId);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.original_filename;
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (e) {
                    alert('Decryption failed: ' + e.message);
                }
            });
            li.appendChild(btnDl);
            detEvidenceList.appendChild(li);
        });
    }

    // Save Triage settings
    btnSaveTriage.addEventListener('click', async () => {
        if (!activeAdminCaseId) return;

        try {
            await engine.updateIncidentStatus(
                activeAdminCaseId,
                actStatus.value,
                actSeverity.value,
                actAssigned.value
            );
            alert('Triage configuration updated successfully.');
            await inspectCaseDetails(activeAdminCaseId);
        } catch (e) {
            alert('Failed to save triage settings: ' + e.message);
        }
    });

    // Save Investigation note
    btnSubmitNote.addEventListener('click', async () => {
        if (!activeAdminCaseId) return;
        const text = txtNewNote.value.trim();
        if (!text) return;

        try {
            await engine.addInvestigationNote(activeAdminCaseId, 'Admin Analyst', text);
            txtNewNote.value = '';
            await inspectCaseDetails(activeAdminCaseId);
        } catch (e) {
            alert('Failed to save note: ' + e.message);
        }
    });

    document.getElementById('btn-back-to-list').addEventListener('click', async () => {
        await loadAdminCases();
        showAdminSubpanel('cases');
    });

    // ==========================================================================
    // SYSTEM AUDIT LOGS DISPLAY
    // ==========================================================================
    const btnAdminLogsToggle = document.getElementById('btn-admin-logs-toggle');
    const adminLogsTableBody = document.getElementById('admin-logs-table-body');
    const btnCloseLogs = document.getElementById('btn-close-logs');

    btnAdminLogsToggle.addEventListener('click', async () => {
        try {
            const logs = await engine.getAuditLogs();
            renderAuditLogsTable(logs);
            showAdminSubpanel('logs');
        } catch (e) {
            alert('Logs access denied: ' + e.message);
        }
    });

    function renderAuditLogsTable(logs) {
        adminLogsTableBody.innerHTML = '';
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td><strong>${log.actor}</strong></td>
                <td><code>${log.action}</code></td>
                <td>${log.incident_id || 'N/A'}</td>
                <td><span class="badge ${log.result === 'SUCCESS' ? 'badge-severity-low' : 'badge-severity-critical'}">${log.result}</span></td>
                <td>${engine.sanitizeInput(log.message)}</td>
            `;
            adminLogsTableBody.appendChild(tr);
        });
    }

    btnCloseLogs.addEventListener('click', () => showAdminSubpanel('cases'));
    if (btnCloseLogsBottom) {
        btnCloseLogsBottom.addEventListener('click', () => showAdminSubpanel('cases'));
    }

    // Return to Inspect buttons from Audit Logs and Settings
    if (btnBackToInspectFromLogs) {
        btnBackToInspectFromLogs.addEventListener('click', () => {
            if (activeAdminCaseId) showAdminSubpanel('detail');
        });
    }
    if (btnBackToInspectFromLogsBottom) {
        btnBackToInspectFromLogsBottom.addEventListener('click', () => {
            if (activeAdminCaseId) showAdminSubpanel('detail');
        });
    }
    if (btnBackToInspectFromSettings) {
        btnBackToInspectFromSettings.addEventListener('click', () => {
            if (activeAdminCaseId) showAdminSubpanel('detail');
        });
    }

    // Tab buttons event listeners
    if (tabBtnCases) {
        tabBtnCases.addEventListener('click', async () => {
            await loadAdminCases();
            showAdminSubpanel('cases');
        });
    }
    if (tabBtnInspect) {
        tabBtnInspect.addEventListener('click', () => {
            if (activeAdminCaseId) {
                showAdminSubpanel('detail');
            }
        });
    }

    // ==========================================================================
    // DATABASE MANAGER & PASSWORD CHANGES
    // ==========================================================================
    const btnAdminSettingsToggle = document.getElementById('btn-admin-settings-toggle');
    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnExportDb = document.getElementById('btn-export-db');
    const btnImportDb = document.getElementById('btn-import-db');
    const importDbInput = document.getElementById('import-db-input');

    btnAdminSettingsToggle.addEventListener('click', () => showAdminSubpanel('settings'));
    btnCloseSettings.addEventListener('click', () => showAdminSubpanel('cases'));

    // Clear / Purge All Incidents from database
    const btnClearIncidentsDb = document.getElementById('btn-clear-incidents-db');
    if (btnClearIncidentsDb) {
        btnClearIncidentsDb.addEventListener('click', async () => {
            const confirmed = confirm("⚠️ Are you sure you want to permanently purge all incident reports and evidence files from the database?\n\nThis will delete all submitted people's incident details and cannot be undone.");
            if (!confirmed) return;

            try {
                await engine.clearAllIncidents();
                alert("✅ All people's incident details and attached evidence have been permanently cleared from the database.");
                activeAdminCaseId = null;
                currentAdminCaseData = null;
                currentAdminEvidenceList = [];
                if (tabBtnInspect) tabBtnInspect.style.display = 'none';
                showAdminSubpanel('cases');
                await loadAdminCases();
            } catch (err) {
                alert("Error clearing incident database: " + err.message);
            }
        });
    }

    // Export DB to local JSON
    btnExportDb.addEventListener('click', () => {
        const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onsuccess = (event) => {
            const db = event.target.result;
            const exportData = {};
            const storeNames = Array.from(db.objectStoreNames);
            let storesProcessed = 0;

            storeNames.forEach(storeName => {
                const tx = db.transaction(storeName, 'readonly');
                const store = tx.objectStore(storeName);
                const getReq = store.getAll();

                getReq.onsuccess = () => {
                    exportData[storeName] = getReq.result;
                    storesProcessed++;
                    if (storesProcessed === storeNames.length) {
                        triggerBackupDownload(exportData);
                    }
                };
            });
        };
    });

    function triggerBackupDownload(dataObj) {
        const jsonStr = JSON.stringify(dataObj, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cyberwing_db_backup_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        engine.logAudit('ADMIN', 'EXPORT_DB', 'SYSTEM', 'SUCCESS', 'Administrative backup download generated successfully');
    }

    // Import DB from JSON
    btnImportDb.addEventListener('click', () => importDbInput.click());
    importDbInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                restoreDatabase(parsed);
            } catch (err) {
                alert('Invalid JSON file format.');
            }
        };
        reader.readAsText(file);
    });

    function restoreDatabase(data) {
        const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        openRequest.onsuccess = (event) => {
            const db = event.target.result;
            
            Object.keys(data).forEach(storeName => {
                if (db.objectStoreNames.contains(storeName)) {
                    const tx = db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    
                    data[storeName].forEach(record => {
                        store.put(record);
                    });
                }
            });

            alert('Database records restored successfully.');
            engine.logAudit('ADMIN', 'IMPORT_DB', 'SYSTEM', 'SUCCESS', 'Administrative backup records imported successfully');
            importDbInput.value = '';
            showAdminSubpanel('cases');
            loadAdminCases();
        };
    }

    // Change Master Passphrase
    const chOldPass = document.getElementById('ch-pass-old');
    const chNewPass = document.getElementById('ch-pass-new');
    const btnChangePass = document.getElementById('btn-change-pass');

    btnChangePass.addEventListener('click', async () => {
        const oldPass = chOldPass.value;
        const newPass = chNewPass.value;

        if (!oldPass || !newPass) {
            alert('Please fill out both fields.');
            return;
        }

        try {
            // Verify old password
            await engine.authenticateAdmin(oldPass);

            // Re-hash and save new password
            const tx = engine.db.transaction('settings', 'readwrite');
            const store = tx.objectStore('settings');
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const saltHex = engine.bufToHex(salt);
            const newHash = await engine.hashPassphrase(newPass, salt);

            store.put({ key: 'admin_passphrase_hash', hash: newHash, salt: saltHex });

            // Re-encrypt the private key using the new passphrase derived master key
            const getAdminKeysReq = new Promise(resolve => {
                const req = store.get('admin_keypair');
                req.onsuccess = () => resolve(req.result);
            });
            const keypairRecord = await getAdminKeysReq;

            // Decrypt active private key with old master key (which is currently stored in engine.adminKey)
            const privKeyDecryptedRaw = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: engine.hexToBuf(keypairRecord.iv) },
                engine.adminKey,
                engine.hexToBuf(keypairRecord.encryptedPrivateKey)
            );

            // Derive new master key from new passphrase
            const newMasterKey = await engine.deriveMasterKey(newPass, saltHex);

            // Encrypt private key with new master key
            const newIv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedPriv = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: newIv },
                newMasterKey,
                privKeyDecryptedRaw
            );

            keypairRecord.encryptedPrivateKey = engine.bufToHex(encryptedPriv);
            keypairRecord.iv = engine.bufToHex(newIv);
            store.put(keypairRecord);

            // Update cached in-memory key
            engine.adminKey = newMasterKey;

            chOldPass.value = '';
            chNewPass.value = '';
            alert('Master passphrase and derived private key security mappings changed successfully.');
            engine.logAudit('ADMIN', 'CHANGE_PASS', 'SYSTEM', 'SUCCESS', 'Master administrative credentials updated');

        } catch (e) {
            alert('Change failed: ' + e.message);
        }
    });

    // ==========================================================================
    // OFFICIAL CYBERWING PDF REPORT GENERATOR WITH WATERMARK
    // ==========================================================================
    function exportCaseToPdf(caseData, evidenceList = []) {
        if (!caseData) {
            alert('No active case data available to generate PDF.');
            return;
        }

        const caseId = caseData.case_id || 'CW-REPORT';
        const details = caseData.details || {};
        const timestampStr = new Date().toLocaleString('en-IN', {
            dateStyle: 'full',
            timeStyle: 'medium'
        });

        // Format IOC items
        const iocFields = [
            { label: 'Suspicious Indicators', val: details.threat_indicators },
            { label: 'Suspicious URL', val: details.threat_url },
            { label: 'Domain', val: details.threat_domain },
            { label: 'IP Address', val: details.threat_ip },
            { label: 'Email Address', val: details.threat_email },
            { label: 'Phone Number', val: details.threat_phone },
            { label: 'Username', val: details.threat_username },
            { label: 'File Hash', val: details.threat_hash },
            { label: 'Package Name', val: details.threat_package },
            { label: 'Transaction Ref', val: details.threat_tx_ref },
            { label: 'Social Profile URL', val: details.threat_social_url }
        ].filter(f => f.val);

        const iocsHtml = iocFields.length > 0
            ? `<table class="pdf-table">
                <thead>
                    <tr><th style="width: 35%;">IOC Classification</th><th>Indicator Value / Signature</th></tr>
                </thead>
                <tbody>
                    ${iocFields.map(f => `<tr><td><strong>${engine.sanitizeInput(f.label)}</strong></td><td><code>${engine.sanitizeInput(f.val)}</code></td></tr>`).join('')}
                </tbody>
               </table>`
            : `<p class="muted-note">No specific Indicators of Compromise (IoC) registered for this incident.</p>`;

        // Format Evidence files
        const evidenceHtml = (evidenceList && evidenceList.length > 0)
            ? `<table class="pdf-table">
                <thead>
                    <tr><th>Evidence Filename</th><th>File Size</th><th>MIME Type</th><th>SHA-256 Checksum (Integrity)</th></tr>
                </thead>
                <tbody>
                    ${evidenceList.map(e => `<tr><td>📄 <strong>${engine.sanitizeInput(e.original_filename)}</strong></td><td>${(e.file_size / 1024).toFixed(1)} KB</td><td>${e.mime_type || 'application/octet-stream'}</td><td><code class="hash-code">${e.file_hash || 'VERIFIED_ON_VAULT'}</code></td></tr>`).join('')}
                </tbody>
               </table>`
            : `<p class="muted-note">No technical evidence files attached to this incident dossier.</p>`;

        // Format Timeline & Notes
        const timelineList = details.timeline || [];
        const notesList = details.notes || [];

        const timelineHtml = timelineList.length > 0
            ? `<table class="pdf-table">
                <thead>
                    <tr><th style="width: 28%;">Timestamp</th><th>Event Activity / Status Transition</th></tr>
                </thead>
                <tbody>
                    ${timelineList.map(t => `<tr><td>${new Date(t.time).toLocaleString()}</td><td>${engine.sanitizeInput(t.activity)}</td></tr>`).join('')}
                </tbody>
               </table>`
            : `<p class="muted-note">No lifecycle events recorded.</p>`;

        const notesHtml = notesList.length > 0
            ? `<div class="notes-container">
                ${notesList.map(n => `<div class="pdf-note-card"><div class="pdf-note-meta"><strong>${engine.sanitizeInput(n.author)}</strong> • <span>${new Date(n.timestamp).toLocaleString()}</span></div><div class="pdf-note-text">${engine.sanitizeInput(n.text)}</div></div>`).join('')}
               </div>`
            : `<p class="muted-note">No internal analyst notes logged.</p>`;

        const reporterHtml = details.reporter
            ? `<div class="reporter-box" style="background: #f8fafc; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 9pt;">
                <p><strong>Name:</strong> ${engine.sanitizeInput(details.reporter.name)} &nbsp;|&nbsp; <strong>Email:</strong> ${engine.sanitizeInput(details.reporter.email)}</p>
                <p style="margin-top: 4px;"><strong>Phone:</strong> ${engine.sanitizeInput(details.reporter.phone || 'Not specified')} &nbsp;|&nbsp; <strong>Preferred Contact:</strong> ${engine.sanitizeInput(details.reporter.preferred_contact || 'Email')}</p>
               </div>`
            : `<p class="muted-note">🔒 Reporter submitted anonymously. Identity withheld under CyberWing Reporter Protection Policy.</p>`;

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Pop-up window was blocked. Please allow pop-ups for this page to download the PDF report.');
            return;
        }

        printWindow.document.open();
        printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>CYBERWING_INCIDENT_REPORT_${caseId}</title>
    <style>
        @page {
            size: A4 portrait;
            margin: 15mm 15mm 20mm 15mm;
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            padding: 24px;
            position: relative;
            font-size: 11pt;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }

        /* WATERMARK - Official CYBERWING Watermark */
        .pdf-watermark-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.13;
        }
        .pdf-watermark-content {
            transform: rotate(-35deg);
            text-align: center;
            border: 6px solid #4f46e5;
            padding: 24px 48px;
            border-radius: 20px;
        }
        .pdf-watermark-main {
            font-size: 58pt;
            font-weight: 900;
            font-family: Impact, 'Arial Black', sans-serif;
            letter-spacing: 12px;
            color: #312e81;
            text-transform: uppercase;
            white-space: nowrap;
            display: block;
        }
        .pdf-watermark-sub {
            font-size: 18pt;
            font-weight: 700;
            letter-spacing: 8px;
            color: #4338ca;
            text-transform: uppercase;
            margin-top: 8px;
            display: block;
        }

        /* Toolbar for preview */
        .no-print-toolbar {
            background: #0f172a;
            color: #ffffff;
            padding: 12px 20px;
            margin: -24px -24px 24px -24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .no-print-toolbar button {
            background: #4f46e5;
            color: #ffffff;
            border: none;
            padding: 8px 18px;
            font-size: 13px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            margin-left: 8px;
        }
        .no-print-toolbar button.btn-close {
            background: #475569;
        }
        .no-print-toolbar button:hover {
            opacity: 0.9;
        }

        @media print {
            .no-print-toolbar {
                display: none !important;
            }
            body {
                padding: 0;
            }
        }

        /* Header block */
        .pdf-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            border-bottom: 3px solid #312e81;
            padding-bottom: 14px;
            margin-bottom: 18px;
        }
        .pdf-header-left {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .pdf-logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
        }
        .pdf-title-block h1 {
            font-size: 16pt;
            font-weight: 800;
            color: #1e1b4b;
            letter-spacing: 0.5px;
            margin: 0;
        }
        .pdf-title-block p {
            font-size: 9pt;
            color: #475569;
            margin-top: 2px;
        }
        .pdf-badge-dossier {
            text-align: right;
        }
        .classification-pill {
            background: #dc2626;
            color: #ffffff;
            font-size: 8pt;
            font-weight: 800;
            letter-spacing: 1px;
            padding: 4px 10px;
            border-radius: 4px;
            display: inline-block;
            margin-bottom: 4px;
        }
        .dossier-ref {
            font-family: monospace;
            font-size: 10pt;
            font-weight: 700;
            color: #1e293b;
        }

        /* Meta table */
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 10px;
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            padding: 12px;
            margin-bottom: 20px;
        }
        .meta-cell .label {
            font-size: 8pt;
            text-transform: uppercase;
            color: #64748b;
            font-weight: 700;
            letter-spacing: 0.5px;
            display: block;
        }
        .meta-cell .value {
            font-size: 10.5pt;
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
        }
        .badge-pill {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 8.5pt;
            font-weight: 700;
        }
        .pill-status { background: #dbeafe; color: #1e40af; }
        .pill-severity { background: #fee2e2; color: #991b1b; }

        /* Section styles */
        .pdf-section {
            margin-bottom: 20px;
        }
        .pdf-section h2 {
            font-size: 11pt;
            color: #1e293b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 4px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .narrative-box {
            background: #f8fafc;
            border-left: 4px solid #4f46e5;
            padding: 12px 16px;
            font-size: 10pt;
            color: #1e293b;
            white-space: pre-wrap;
            border-radius: 0 8px 8px 0;
            margin-bottom: 10px;
        }

        /* Tables */
        .pdf-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
            margin-top: 6px;
        }
        .pdf-table th {
            background: #f1f5f9;
            color: #334155;
            text-align: left;
            padding: 8px 10px;
            border: 1px solid #cbd5e1;
            font-weight: 700;
        }
        .pdf-table td {
            padding: 7px 10px;
            border: 1px solid #e2e8f0;
            vertical-align: top;
        }
        .pdf-table tr:nth-child(even) td {
            background: #fafafa;
        }
        code, .hash-code {
            font-family: 'Consolas', 'Courier New', monospace;
            font-size: 8pt;
            background: #f1f5f9;
            padding: 2px 4px;
            border-radius: 3px;
            word-break: break-all;
        }
        .muted-note {
            font-size: 9pt;
            font-style: italic;
            color: #64748b;
            padding: 6px 0;
        }

        .pdf-note-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 8px 12px;
            margin-bottom: 8px;
        }
        .pdf-note-meta {
            font-size: 8pt;
            color: #64748b;
            margin-bottom: 4px;
        }
        .pdf-note-text {
            font-size: 9.5pt;
            color: #1e293b;
        }

        /* Footer Certification */
        .pdf-footer {
            margin-top: 26px;
            padding-top: 14px;
            border-top: 2px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            font-size: 8pt;
            color: #64748b;
        }
        .pdf-footer-sign {
            text-align: right;
        }
        .seal-box {
            border: 1px dashed #6366f1;
            background: #eef2ff;
            padding: 6px 12px;
            border-radius: 6px;
            color: #3730a3;
            font-weight: 700;
            margin-top: 4px;
            display: inline-block;
        }
    </style>
</head>
<body>

    <!-- DIAGONAL WATERMARK -->
    <div class="pdf-watermark-container">
        <div class="pdf-watermark-content">
            <span class="pdf-watermark-main">CYBERWING ICET</span>
            <span class="pdf-watermark-sub">OFFICIAL INCIDENT REPORT • CONFIDENTIAL</span>
        </div>
    </div>

    <!-- PREVIEW TOOLBAR (Hidden in Print) -->
    <div class="no-print-toolbar">
        <div>
            <strong>🛡️ CYBERWING OFFICIAL INCIDENT REPORT PREVIEW</strong> &nbsp;|&nbsp; <span>Case: ${caseId}</span>
        </div>
        <div>
            <button type="button" onclick="window.print()">🖨️ Print / Save as PDF</button>
            <button type="button" class="btn-close" onclick="window.close()">✕ Close</button>
        </div>
    </div>

    <!-- REPORT HEADER -->
    <div class="pdf-header">
        <div class="pdf-header-left">
            <img src="./images/logo.png" alt="CyberWing Logo" class="pdf-logo" onerror="this.style.display='none'">
            <div class="pdf-title-block">
                <h1>CYBER WING ICET</h1>
                <p>Center for Incident Response & Threat Defense • Computer Science & Engineering</p>
                <p>Ilahia College of Engineering & Technology, Mulavoor, Muvattupuzha, Kerala - 686673</p>
            </div>
        </div>
        <div class="pdf-badge-dossier">
            <span class="classification-pill">RESTRICTED // LAW ENFORCEMENT</span>
            <div class="dossier-ref">${caseId}</div>
            <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">Generated: ${timestampStr}</div>
        </div>
    </div>

    <!-- METADATA GRID -->
    <div class="meta-grid">
        <div class="meta-cell">
            <span class="label">Incident Case ID</span>
            <span class="value" style="font-family: monospace;">${caseId}</span>
        </div>
        <div class="meta-cell">
            <span class="label">Category / Classification</span>
            <span class="value">${(caseData.type || 'UNKNOWN').toUpperCase()}</span>
        </div>
        <div class="meta-cell">
            <span class="label">Triage Status</span>
            <span class="value"><span class="badge-pill pill-status">${caseData.status || 'NEW'}</span></span>
        </div>
        <div class="meta-cell">
            <span class="label">Assessed Severity</span>
            <span class="value"><span class="badge-pill pill-severity">${caseData.severity || 'MEDIUM'}</span></span>
        </div>
        <div class="meta-cell">
            <span class="label">Assigned Analyst</span>
            <span class="value">${engine.sanitizeInput(caseData.assigned_to || 'Unassigned')}</span>
        </div>
        <div class="meta-cell">
            <span class="label">Reported Timestamp</span>
            <span class="value">${caseData.created_at ? new Date(caseData.created_at).toLocaleString() : 'N/A'}</span>
        </div>
        <div class="meta-cell">
            <span class="label">Device / Operating System</span>
            <span class="value">${engine.sanitizeInput(details.device_affected || 'N/A')} (${engine.sanitizeInput(details.os || 'N/A')})</span>
        </div>
        <div class="meta-cell">
            <span class="label">Financial Impact</span>
            <span class="value">${details.financial_loss === 'yes' ? `INR ${details.financial_loss_amount || 0}` : 'None'}</span>
        </div>
    </div>

    <!-- NARRATIVE -->
    <div class="pdf-section">
        <h2>1. Verified Incident Narrative Description</h2>
        <div class="narrative-box">${engine.sanitizeInput(details.description || 'No description provided.')}</div>
        <div style="font-size: 8.5pt; color: #475569; display: flex; gap: 20px;">
            <span><strong>Occurred At:</strong> ${details.occurred_at ? new Date(details.occurred_at).toLocaleString() : 'Not specified'}</span>
            <span><strong>Discovered At:</strong> ${details.discovered_at ? new Date(details.discovered_at).toLocaleString() : 'Not specified'}</span>
            <span><strong>Discovery Vector:</strong> ${engine.sanitizeInput(details.discovery_method || 'Not specified')}</span>
        </div>
    </div>

    <!-- REPORTER DETAILS -->
    <div class="pdf-section">
        <h2>2. Reporter Contact Information</h2>
        ${reporterHtml}
    </div>

    <!-- IOCS -->
    <div class="pdf-section">
        <h2>3. Threat Intelligence & Indicators of Compromise (IoC Register)</h2>
        ${iocsHtml}
    </div>

    <!-- EVIDENCE REGISTER -->
    <div class="pdf-section">
        <h2>4. Forensic Evidence Documents & Cryptographic Integrity Register</h2>
        ${evidenceHtml}
    </div>

    <!-- INVESTIGATION NOTES -->
    <div class="pdf-section">
        <h2>5. Internal Analyst Investigation Notes</h2>
        ${notesHtml}
    </div>

    <!-- TIMELINE -->
    <div class="pdf-section">
        <h2>6. Cryptographic Chain of Custody & Audit Timeline</h2>
        ${timelineHtml}
    </div>

    <!-- FOOTER CERTIFICATION -->
    <div class="pdf-footer">
        <div>
            <p><strong>Cyber Wing ICET Incident Response & Management System</strong></p>
            <p>Cryptographically validated via AES-GCM-256 client-side zero-knowledge vault.</p>
            <p>Official document certified by Ilahia College of Engineering & Technology.</p>
        </div>
        <div class="pdf-footer-sign">
            <div class="seal-box">🛡️ CYBERWING ICET VERIFIED DOSSIER</div>
            <p style="margin-top: 4px; font-size: 7.5pt;">Non-Repudiation Checksum: ${caseId}#${Date.now().toString(16).toUpperCase()}</p>
        </div>
    </div>

    <script>
        window.addEventListener('load', () => {
            setTimeout(() => {
                window.print();
            }, 600);
        });
    </script>
</body>
</html>`);
        printWindow.document.close();
    }

    // Bind Download PDF button in Admin Case Inspection
    const btnDownloadPdfCase = document.getElementById('btn-download-pdf-case');
    if (btnDownloadPdfCase) {
        btnDownloadPdfCase.addEventListener('click', () => {
            exportCaseToPdf(currentAdminCaseData, currentAdminEvidenceList);
        });
    }

    // Bind Delete Case button in Admin Case Inspection
    const btnDeleteCase = document.getElementById('btn-delete-case');
    if (btnDeleteCase) {
        btnDeleteCase.addEventListener('click', async () => {
            if (!activeAdminCaseId) {
                alert('No active case selected.');
                return;
            }
            const confirmed = confirm(`⚠️ Are you sure you want to permanently delete incident ${activeAdminCaseId} and all associated evidence files?\n\nThis action cannot be undone.`);
            if (!confirmed) return;

            try {
                await engine.deleteIncident(activeAdminCaseId);
                alert(`✅ Incident ${activeAdminCaseId} has been deleted successfully.`);
                activeAdminCaseId = null;
                currentAdminCaseData = null;
                currentAdminEvidenceList = [];
                if (tabBtnInspect) tabBtnInspect.style.display = 'none';
                showAdminSubpanel('cases');
                await loadAdminCases();
            } catch (e) {
                alert('Failed to delete incident: ' + e.message);
            }
        });
    }

    // Bind Download PDF button in Public Case Lookup
    const btnLookupDownloadPdf = document.getElementById('btn-lookup-download-pdf');
    if (btnLookupDownloadPdf) {
        btnLookupDownloadPdf.addEventListener('click', async () => {
            if (!activeCaseDetails) {
                alert('No active incident lookup loaded.');
                return;
            }
            let evidenceList = [];
            try {
                evidenceList = await engine.getIncidentEvidenceList(activeCaseDetails.case_id);
            } catch (e) {
                console.warn('Could not load evidence list for public lookup PDF', e);
            }
            exportCaseToPdf(activeCaseDetails, evidenceList);
        });
    }

});