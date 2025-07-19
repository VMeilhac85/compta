<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Ici vous pouvez définir vos routes d’API. Si vous n'en utilisez pas
| pour l'instant, vous pouvez laisser ce fichier vide ou conserver
| cet exemple par défaut.
|
*/

Route::middleware('auth:api')->get('/user', function (Request $request) {
    return $request->user();
});
