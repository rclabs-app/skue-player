<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Device;
use App\Services\DevicePlaylistService;
use App\Services\DeviceRegistrationService;
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
    public function login(Request $request, DeviceRegistrationService $registrations)
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

        $mac = strtoupper($request->mac);
        $key = strtoupper(trim($request->device_key));
        $device = $registrations->confirm($mac, $key);

        if (!$device) {
            return back()->withErrors(['mac' => 'MAC ou chave inválidos ou expirados. Confira os dados exibidos no aplicativo.'])->withInput();
        }

        if (strtoupper($device->device_key) !== strtoupper($request->device_key)) {
            return back()->withErrors(['device_key' => 'O Device Key está incorreto.'])->withInput();
        }

        if ($device->isKeyExpired()) {
            return back()->withErrors(['device_key' => 'Este Device Key expirou. Por favor, solicite um novo na sua TV.'])->withInput();
        }

        // Login successful
        $request->session()->regenerate();
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

    public function storePlaylist(Request $request, DevicePlaylistService $playlists)
    {
        $device = $this->sessionDevice();
        if (!$device) return redirect()->route('portal.login');

        // Accept host from older forms while using the same URL contract as the API.
        $input = $request->all();
        if (($input['type'] ?? null) === 'xtream' && empty($input['url'])) {
            $input['url'] = $input['host'] ?? null;
        }
        $playlists->save($device, $input);

        return redirect()->route('portal.dashboard')->with('success', 'Playlist adicionada com sucesso!');
    }

    public function editPlaylist(int $id)
    {
        $device = $this->sessionDevice();
        if (!$device) return redirect()->route('portal.login');
        $playlist = $device->playlists()->findOrFail($id);

        return view('portal.edit', compact('playlist'));
    }

    public function updatePlaylist(Request $request, int $id, DevicePlaylistService $playlists)
    {
        $device = $this->sessionDevice();
        if (!$device) return redirect()->route('portal.login');
        $playlists->save($device, $request->all(), $id);

        return redirect()->route('portal.dashboard')->with('success', 'Playlist atualizada com sucesso!');
    }

    public function setMainPlaylist(int $id, DevicePlaylistService $playlists)
    {
        $device = $this->sessionDevice();
        if (!$device) return redirect()->route('portal.login');
        $playlists->setMain($device, $id);

        return redirect()->route('portal.dashboard')->with('success', 'Lista principal atualizada!');
    }

    public function destroyPlaylist(int $id, DevicePlaylistService $playlists)
    {
        $device = $this->sessionDevice();
        if (!$device) return redirect()->route('portal.login');
        $playlists->delete($device, $id);

        return redirect()->route('portal.dashboard')->with('success', 'Playlist removida com sucesso!');
    }

    private function sessionDevice(): ?Device
    {
        return Device::find(Session::get('portal_device_id'));
    }
}
