<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Device;
use Illuminate\Support\Facades\Session;

class PortalController extends Controller
{
    /**
     * Show the login form for the portal.
     */
    public function showLoginForm()
    {
        // If already logged in, redirect to dashboard
        if (Session::has('portal_device_id')) {
            return redirect()->route('portal.dashboard');
        }

        return view('portal.login');
    }

    /**
     * Handle the portal login request.
     */
    public function login(Request $request)
    {
        // Normalize MAC by removing any non-alphanumeric chars
        $rawMac = preg_replace('/[^0-9A-Za-z]/', '', $request->mac);
        
        // Auto-format to XX:XX:XX:XX:XX:XX if it's 12 chars
        $formattedMac = $rawMac;
        if (strlen($rawMac) === 12) {
            $formattedMac = implode(':', str_split($rawMac, 2));
        }

        // Merge back into request for validation
        $request->merge(['mac' => $formattedMac]);

        $request->validate([
            'mac' => 'required|string|regex:/^([0-9A-Za-z]{2}[:-]){5}([0-9A-Za-z]{2})$/',
            'device_key' => 'required|string|min:6|max:6',
        ], [
            'mac.required' => 'O endereço MAC é obrigatório.',
            'mac.regex' => 'O formato do MAC Address é inválido.',
            'device_key.required' => 'A Chave do Dispositivo é obrigatória.',
        ]);

        $device = Device::where('mac', strtoupper($request->mac))->first();

        if (!$device) {
            return back()->withErrors(['mac' => 'Dispositivo não encontrado. Verifique o MAC e tente novamente.'])->withInput();
        }

        if (strtoupper($device->device_key) !== strtoupper($request->device_key)) {
            return back()->withErrors(['device_key' => 'O Device Key está incorreto.'])->withInput();
        }

        if ($device->isKeyExpired()) {
            return back()->withErrors(['device_key' => 'Este Device Key expirou. Por favor, solicite um novo na sua TV.'])->withInput();
        }

        // Login successful
        Session::put('portal_device_id', $device->id);

        return redirect()->route('portal.dashboard')->with('success', 'Dispositivo autenticado com sucesso!');
    }

    /**
     * Log out the device from the portal.
     */
    public function logout()
    {
        Session::forget('portal_device_id');
        return redirect()->route('portal.login')->with('success', 'Sessão encerrada com sucesso.');
    }

    /**
     * Show the portal dashboard.
     */
    public function dashboard()
    {
        if (!Session::has('portal_device_id')) {
            return redirect()->route('portal.login')->withErrors(['mac' => 'Você precisa fazer login para acessar o painel.']);
        }

        $device = Device::with('playlists')->find(Session::get('portal_device_id'));

        if (!$device) {
            Session::forget('portal_device_id');
            return redirect()->route('portal.login');
        }

        return view('portal.dashboard', compact('device'));
    }

    /**
     * Store a new playlist for the authenticated device.
     */
    public function storePlaylist(Request $request)
    {
        if (!Session::has('portal_device_id')) {
            return redirect()->route('portal.login');
        }

        $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:m3u,xtream',
            'url' => 'required_if:type,m3u|nullable|url',
            'host' => 'required_if:type,xtream|nullable|url',
            'username' => 'required_if:type,xtream|nullable|string',
            'password' => 'required_if:type,xtream|nullable|string',
        ]);

        $device = Device::find(Session::get('portal_device_id'));

        $url = $request->type === 'm3u' ? $request->url : $request->host;

        $device->playlists()->create([
            'name' => $request->name,
            'type' => $request->type,
            'url' => $url,
            'username' => $request->username,
            'password' => $request->password,
            'is_active' => true,
        ]);

        return redirect()->route('portal.dashboard')->with('success', 'Playlist adicionada com sucesso!');
    }

    /**
     * Delete a playlist from the authenticated device.
     */
    public function destroyPlaylist($id)
    {
        if (!Session::has('portal_device_id')) {
            return redirect()->route('portal.login');
        }

        $device = Device::find(Session::get('portal_device_id'));
        
        $playlist = $device->playlists()->where('id', $id)->firstOrFail();
        $playlist->delete();

        return redirect()->route('portal.dashboard')->with('success', 'Playlist removida com sucesso!');
    }
}
