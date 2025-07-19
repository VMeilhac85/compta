<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\HomeController;
use App\Http\Controllers\CompteController;
use App\Http\Controllers\EcritureController;
use App\Http\Controllers\ConsultController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', [ConsultController::class, 'balance'])
     ->name('home')
     ->middleware('auth');
Auth::routes();

Route::get('/home', [HomeController::class, 'index'])
     ->name('home')
     ->middleware('auth');

Route::get('/consult/balance', [ConsultController::class, 'balance'])
     ->name('consult.balance')
     ->middleware('auth');

Route::post('/consult/balance/transfer', [ConsultController::class, 'balanceBulkTransfer'])
     ->name('consult.balance.transfer')
     ->middleware('auth');

Route::post('/consult/balance/export', [ConsultController::class, 'balanceBulkExport'])
     ->name('consult.balance.export')
     ->middleware('auth');

Route::get('/consult/grand-livre', [ConsultController::class, 'grandLivre'])
     ->name('consult.grand_livre')
     ->middleware('auth');

Route::post('/consult/grand-livre/delete', [ConsultController::class, 'bulkDelete'])
     ->name('consult.grand_livre.delete')
     ->middleware('auth');

Route::post('/consult/grand-livre/duplicate', [ConsultController::class, 'bulkDuplicate'])
     ->name('consult.grand_livre.duplicate')
     ->middleware('auth');

Route::post('/consult/grand-livre/transfer', [ConsultController::class, 'bulkTransfer'])
     ->name('consult.grand_livre.transfer')
     ->middleware('auth');

Route::post('/consult/grand-livre/export', [ConsultController::class, 'bulkExport'])
     ->name('consult.grand_livre.export')
     ->middleware('auth');

// Recherche avancée
Route::get('/consult/rechercher', [ConsultController::class, 'search'])
     ->name('consult.search')
     ->middleware('auth');

Route::post('/consult/rechercher/delete', [ConsultController::class, 'searchBulkDelete'])
     ->name('consult.search.delete')
     ->middleware('auth');

Route::post('/consult/rechercher/duplicate', [ConsultController::class, 'searchBulkDuplicate'])
     ->name('consult.search.duplicate')
     ->middleware('auth');

Route::post('/consult/rechercher/transfer', [ConsultController::class, 'searchBulkTransfer'])
     ->name('consult.search.transfer')
     ->middleware('auth');

Route::post('/consult/rechercher/export', [ConsultController::class, 'searchBulkExport'])
     ->name('consult.search.export')
     ->middleware('auth');

// Création et gestion des comptes
Route::post('/comptes', [CompteController::class, 'store'])
     ->name('comptes.store')
     ->middleware('auth');

// Route AJAX pour compte par défaut
Route::get('/ecritures/default-compte', [EcritureController::class, 'defaultCompte'])
     ->name('ecritures.default_compte')
     ->middleware('auth');

// CRUD sur les écritures
Route::resource('ecritures', EcritureController::class)
     ->except(['show'])
     ->middleware('auth');

// Consultation du journal
Route::get('/ecritures/journal', [ConsultController::class, 'journal'])
     ->name('ecritures.journal')
     ->middleware('auth');

// Bulk actions Journal
Route::post('/consult/journal/delete',    [ConsultController::class, 'journalBulkDelete'])
     ->name('consult.journal.delete')
     ->middleware('auth');

Route::post('/consult/journal/duplicate', [ConsultController::class, 'journalBulkDuplicate'])
     ->name('consult.journal.duplicate')
     ->middleware('auth');

Route::post('/consult/journal/transfer',  [ConsultController::class, 'journalBulkTransfer'])
     ->name('consult.journal.transfer')
     ->middleware('auth');

Route::post('/consult/journal/export',    [ConsultController::class, 'journalBulkExport'])
     ->name('consult.journal.export')
     ->middleware('auth');

// Plan comptable (Paramètres)
Route::get('/parametres/plan-comptable', [CompteController::class, 'index'])
     ->name('parametres.plan_comptable')
     ->middleware('auth');

Route::put('/parametres/plan-comptable/{compte}', [CompteController::class, 'update'])
     ->name('parametres.plan_comptable.update')
     ->middleware('auth');

Route::delete('/parametres/plan-comptable/{compte}', [CompteController::class, 'destroy'])
     ->name('parametres.plan_comptable.destroy')
     ->middleware('auth');
