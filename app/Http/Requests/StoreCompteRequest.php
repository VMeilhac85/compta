<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCompteRequest extends FormRequest
{
    public function authorize()
    {
        return true;
    }

    public function rules()
    {
        return [
            'account_number' => [
                'required',
                'digits:6',
                Rule::unique('comptes', 'account_number'),
            ],
            // autres champs…
        ];
    }

    public function messages()
    {
        return [
            'account_number.required' => 'Le numéro de compte est obligatoire.',
            'account_number.digits'   => 'Le numéro de compte doit contenir exactement 6 chiffres.',
            'account_number.unique'   => 'Ce numéro de compte existe déjà.',
        ];
    }
}
