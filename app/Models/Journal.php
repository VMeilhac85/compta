<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Journal extends Model
{
    // la table s'appelle 'journaux' et la PK est 'code'
    protected $table = 'journaux';
    protected $primaryKey = 'code';
    public $incrementing = false;
    protected $keyType = 'string';

    // si vous n'avez pas created_at/updated_at ou ne les gérez pas via Eloquent
    public $timestamps = false;

    protected $fillable = ['code', 'name'];
}
