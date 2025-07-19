<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ligne extends Model
{
    protected $fillable = [
        'ecriture', 'compte', 'montant', 'commentaire'
    ];

    public function ecriture()
    {
        return $this->belongsTo(Ecriture::class, 'ecriture');
    }
}