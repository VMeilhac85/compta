import Foundation

enum NativeBridgeScript {
    static func documentStart(
        secureSession: SecureWebSession?,
        pendingSharedFiles: Bool,
        homeTextScale: Double = 1,
        contentVisible: Bool = false
    ) -> String {
        appVersionAssignment()
            + "\n" + contentVisibilityAssignment(contentVisible)
            + "\n" + secureSessionAssignment(secureSession)
            + "\n" + pendingSharedFilesAssignment(pendingSharedFiles)
            + "\n" + homeTextScaleAssignment(homeTextScale)
            + "\n" + bridgeSource
    }

    static func contentVisibilityAssignment(_ visible: Bool) -> String {
        """
        (() => {
            const visible = \(visible ? "true" : "false");
            window.__MAISON_PILOTE_IOS_CONTENT_VISIBLE__ = visible;
            window.dispatchEvent(new CustomEvent('maisonpilote:native-content-visibility', {
                detail: { visible }
            }));
        })();
        """
    }

    static func homeTextScaleAssignment(_ factor: Double) -> String {
        let scale = factor.isFinite && factor > 0 ? factor : 1
        return """
        (() => {
            const apply = () => {
                const root = document.documentElement;
                if (!root) return;
                root.style.setProperty('--mobile-home-font-scale', String(\(scale)));
                root.dataset.mobileHomeLargeText = \(scale) >= 1.3 ? 'true' : 'false';
                // Recompute runtime text fitting and open-menu bounds as well.
                window.dispatchEvent(new Event('resize'));
            };
            if (document.documentElement) apply();
            else document.addEventListener('DOMContentLoaded', apply, { once: true });
        })();
        """
    }

    private static func appVersionAssignment() -> String {
        let versionName = Bundle.main.object(
            forInfoDictionaryKey: "CFBundleShortVersionString"
        ) as? String ?? "0"
        let versionCode = Int(
            Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        ) ?? 0
        let configuredChannel = Bundle.main.object(
            forInfoDictionaryKey: "MaisonPiloteReleaseChannel"
        ) as? String
        let channel = configuredChannel == "production" ? "production" : "beta"
        let payload: [String: Any] = [
            "versionCode": versionCode,
            "versionName": versionName,
            "platform": "ios",
            "channel": channel,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: payload),
              let json = String(data: data, encoding: .utf8) else {
            return "window.__MAISON_PILOTE_IOS_APP__ = {versionCode: 0, versionName: '0', platform: 'ios', channel: 'beta'};"
        }
        return "window.__MAISON_PILOTE_IOS_APP__ = \(json);"
    }

    static func secureSessionAssignment(_ session: SecureWebSession?) -> String {
        guard let session else {
            return "delete window.__MAISON_PILOTE_IOS_SESSION__;"
        }

        let expiresAt: Any = session.expiresAt.map { $0 as Any } ?? NSNull()
        let sessionObject: [String: Any] = [
            "token": session.token,
            "expiresAt": expiresAt,
        ]
        guard let payload = try? JSONSerialization.data(withJSONObject: sessionObject),
              let json = String(data: payload, encoding: .utf8) else {
            return "delete window.__MAISON_PILOTE_IOS_SESSION__;"
        }
        return "window.__MAISON_PILOTE_IOS_SESSION__ = \(json);"
    }

    private static func pendingSharedFilesAssignment(_ pending: Bool) -> String {
        "window.__MAISON_PILOTE_IOS_PENDING_SHARE__ = \(pending ? "true" : "false");"
    }

    private static let bridgeSource = #"""
    (() => {
        const speech = window.webkit?.messageHandlers?.speechRecognition;
        const native = window.webkit?.messageHandlers?.maisonPiloteNative;
        const secureSession = window.webkit?.messageHandlers?.secureSession;
        const biometric = window.webkit?.messageHandlers?.biometricAuthentication;
        const outgoingDocument = window.webkit?.messageHandlers?.outgoingDocument;
        const post = (handler, payload) => {
            if (!handler) { return false; }
            handler.postMessage(payload);
            return true;
        };

        window.addEventListener('maisonpilote:native-runtime-ready', () => {
            post(native, { action: 'ready' });
        });

        window.MaisonPiloteNative = Object.assign({}, window.MaisonPiloteNative || {}, {
            platform: 'ios',
            bridgeVersion: 6,
            supportsAuthenticatorLinks: true,
            speechRecognition: {
                start: (language = 'fr-FR') => post(speech, { action: 'start', language }),
                cancel: () => post(speech, { action: 'cancel', language: 'fr-FR' })
            },
            secureSession: {
                store: (token, expiresAt = null, deviceId = null) => post(secureSession, {
                    action: 'store',
                    token: String(token || ''),
                    expiresAt: expiresAt == null ? null : String(expiresAt),
                    deviceId: deviceId == null ? null : String(deviceId)
                }),
                bindDevice: (deviceId) => post(secureSession, {
                    action: 'bindDevice',
                    deviceId: String(deviceId || '')
                }),
                clear: ({ preserveNavigation = false } = {}) => post(secureSession, {
                    action: 'clear', preserve_navigation: Boolean(preserveNavigation)
                })
            },
            biometricAuthentication: {
                authenticate: () => post(biometric, { action: 'authenticate' })
            },
            pushNotifications: {
                requestAuthorization: () => post(native, {
                    action: 'pushNotifications.requestAuthorization'
                }),
                refresh: () => post(native, { action: 'pushNotifications.refresh' })
            },
            shareInbox: {
                refresh: () => post(native, { action: 'shareInbox.refresh' }),
                discard: (id, requestId = '') => post(native, {
                    action: 'shareInbox.discard',
                    id: String(id || ''),
                    request_id: String(requestId || '')
                }),
                readChunk: (batchId, fileId, offset, length, requestId) => post(native, {
                    action: 'shareInbox.readChunk',
                    batch_id: String(batchId || ''),
                    file_id: String(fileId || ''),
                    offset: Number(offset),
                    length: Number(length),
                    request_id: String(requestId || '')
                })
            },
            outgoingDocument: {
                begin: ({ requestId, transferId, fileName, mimeType, totalSize }) => post(
                    outgoingDocument,
                    {
                        action: 'outgoingDocument.begin',
                        request_id: String(requestId || ''),
                        transfer_id: String(transferId || ''),
                        file_name: String(fileName || ''),
                        mime_type: String(mimeType || ''),
                        total_size: Number(totalSize)
                    }
                ),
                append: ({ requestId, transferId, offset, dataBase64 }) => post(
                    outgoingDocument,
                    {
                        action: 'outgoingDocument.append',
                        request_id: String(requestId || ''),
                        transfer_id: String(transferId || ''),
                        offset: Number(offset),
                        data_base64: String(dataBase64 || '')
                    }
                ),
                finish: ({ requestId, transferId, mode = 'preview' }) => post(
                    outgoingDocument,
                    {
                        action: 'outgoingDocument.finish',
                        request_id: String(requestId || ''),
                        transfer_id: String(transferId || ''),
                        mode: String(mode || 'preview')
                    }
                ),
                cancel: ({ requestId, transferId }) => post(outgoingDocument, {
                    action: 'outgoingDocument.cancel',
                    request_id: String(requestId || ''),
                    transfer_id: String(transferId || '')
                }),
                cleanup: ({ requestId, transferId }) => post(outgoingDocument, {
                    action: 'outgoingDocument.cleanup',
                    request_id: String(requestId || ''),
                    transfer_id: String(transferId || '')
                })
            },
            secureDrafts: {
                refresh: () => post(native, { action: 'secureDrafts.refresh' }),
                write: (key, value) => post(native, {
                    action: 'secureDrafts.write', key: String(key || ''), value: String(value ?? '')
                }),
                remove: (key) => post(native, {
                    action: 'secureDrafts.remove', key: String(key || '')
                })
            },
            navigation: {
                bindIdentity: (userId) => post(native, {
                    action: 'navigation.bindIdentity', user_id: String(userId || '')
                }),
                acknowledge: (requestId, outcome = 'completed') => post(native, {
                    action: 'navigation.ack', request_id: String(requestId || ''),
                    outcome: String(outcome || '')
                }),
                retry: () => post(native, { action: 'navigation.retry' })
            },
            assistantRequest: {
                acknowledge: (id) => post(native, {
                    action: 'assistantRequest.ack',
                    id: String(id || '')
                })
            },
            openExternal: (url) => post(native, { action: 'openExternal', url: String(url || '') }),
            ready: () => post(native, { action: 'ready' })
        });
    })();
    """#

    static let documentEnd = #"""
    window.dispatchEvent(new CustomEvent('maisonpilote:native-bridge-ready', {
        detail: { platform: 'ios', bridgeVersion: 6 }
    }));
    """#
}
