<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Compte extends Model
{
    // La clé primaire est “numero”
    protected $primaryKey = 'numero';
    // Pas d’auto‑incrémentation
    public $incrementing = false;
    // Traiter la PK comme une string (pour conserver les éventuels zéros en tête)
    protected $keyType = 'string';
    // Autoriser le mass‑assignment de ces colonnes
    protected $fillable = [
        'numero',
        'libelle',
    ];
    // Pas de timestamps
    public $timestamps = false;
}
