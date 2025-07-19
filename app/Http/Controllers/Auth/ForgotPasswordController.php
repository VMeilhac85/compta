<?php

namespace App\Http\Controllers\Auth;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\SendsPasswordResetEmails;

class ForgotPasswordController extends Controller
{
    use SendsPasswordResetEmails;

    /**
     * Message de succès après envoi du lien.
     */
    protected function sendResetLinkResponse(Request $request, $response)
    {
        return back()->with('status', 'Votre lien de réinitialisation a bien été envoyé par email !');
    }

    /**
     * Message d’erreur lors d’un échec d’envoi (utilisateur introuvable ou trop de requêtes).
     */
    protected function sendResetLinkFailedResponse(Request $request, $response)
    {
        // Le framework renvoie 'passwords.throttled' si on a trop retrié
        if ($response === \Password::RESET_THROTTLED) {
            return back()->withErrors([
                'email' => 'Merci de patienter quelques instants avant de réessayer.',
            ]);
        }

        // Sinon, message par défaut ou personnalisé pour utilisateur non trouvé
        return back()->withErrors([
            'email' => 'Aucun compte trouvé avec cette adresse e‑mail.',
        ]);
    }
}
