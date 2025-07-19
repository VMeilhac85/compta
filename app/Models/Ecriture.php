<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Ecriture extends Model
{
    protected $fillable = [
        'journal',
        'date',
        'label',
        'lignes',             // ← on le rend fillable
        'user_creation',
        'user_modification',
    ];

    public function lignes()
    {
        return $this->hasMany(Ligne::class, 'ecriture');
    }
}
