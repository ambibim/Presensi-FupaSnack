/**
   * Save attendance uniquely (idempotent).
   * @param {{uid:string, name:string, jenis:string, coords:Object, photoURL:string, public_id:string}} data
   */
  async function saveAttendanceUnique({ uid, name, jenis, coords, photoURL, public_id }) {
    const now = Time.now();
    const ymd = Rules.ymd(now);
    const docId = `${uid}_${ymd}_${jenis}`;
    const ref = col.attendance().doc(docId);
    const snapshot = await ref.get();
    const evalRes = Rules.evaluateStatus(now, jenis);
    const payload = {
      uid,
      name,
      date: ymd,
      jenis,
      status: evalRes.status,
      reason: evalRes.reason,
      timeServer: firebase.firestore.FieldValue.serverTimestamp(),
      timeClient: now.toISOString(),
      coords: coords || null,
      photoURL,
      public_id
    };
    // overwrite or create
    await ref.set(payload, { merge: true });
    return payload;
  }

  /* =============================
     Admin functions (shared)
     ============================= */

  /**
   * Create new employee account without signing out current admin.
   * Uses secondary Firebase Auth instance.
   * @param {string} email 
   * @param {string} password 
   * @param {'karyawan'} role  // only 'karyawan' for employees
   */
  async function createEmployee(email, password, role = 'karyawan') {
    // create in Auth
    const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    // map role and create Firestore user doc
    await col.users().doc(uid).set({
      email,
      name: email.split('@')[0],
      address: '',
      photoURL: '',
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return uid;
  }

  /**
   * Export array of objects to CSV (UTF-8 BOM) and trigger download.
   * @param {Array<Object>} records 
   * @param {string} filename 
   */
  function exportToCSV(records, filename = 'export.csv') {
    if (!records.length) throw new Error('No data to export');
    const keys = Object.keys(records[0]);
    const lines = [
      '\uFEFF' + keys.join(','), // UTF-8 BOM
      ...records.map(r => keys.map(k => `"${String(r[k] ?? '').replace(/"/g,'""')}"`).join(','))
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a);
    a.click(); URL.revokeObjectURL(url); a.remove();
  }

  /**
   * Delete an attendance entry: remove document and soft-delete its Cloudinary photo.
   * @param {string} docId 
   * @param {string} publicId 
   */
  async function deleteAttendanceEntry(docId, publicId) {
    // Firestore delete
    await col.attendance().doc(docId).delete();
    // attempt soft-delete photo
    await softDeleteCloudinary(publicId);
  }

  /**
   * Create or update an override rule (admin).
   * @param {{mode:'non-presensi'|'wajib', start:string, end:string, description?:string}} data 
   */
  async function overridePresensi({ mode, start, end, description = '' }) {
    // each override is a separate doc
    const payload = {
      mode,            // 'non-presensi' or 'wajib'
      start,           // 'YYYY-MM-DD'
      end,             // 'YYYY-MM-DD'
      description,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = col.overrides().doc(); 
    await ref.set(payload);
    return ref.id;
  }

  /**
   * Create a new announcement (admin).
   * @param {{date:string, time:string, description:string}} data 
   */
  async function createAnnouncement({ date, time, description }) {
    const payload = {
      date,            // 'YYYY-MM-DD'
      time,            // 'HH:mm'
      description,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const ref = col.announcements().doc();
    await ref.set(payload);
    return ref.id;
  }

  /* =============================
     Expose shared APIs globally
     ============================= */
  window.app = {
    // Authentication & guards
    auth: firebase.auth(),
    guard,
    ensureUserDoc,
    getRole,
    redirectByRole,

    // Time & rules
    Time,
    Rules,

    // Collections
    col,

    // Overrides & announcements
    getOverrideForDate,
    onAnnouncements,

    // Notifications
    pushNotif,
    onMyNotifs,
    markNotifRead,
    deleteNotif,

    // Profile
    updateProfile,
    loadMyProfile,

    // Geolocation & camera
    getLocation,
    startCamera,
    stopCamera,
    capturePhotoCompressed,

    // Cloudinary
    uploadToCloudinary,
    softDeleteCloudinary,

    // Attendance
    saveAttendanceUnique,
    deleteAttendanceEntry,

    // Admin utilities
    createEmployee,
    overridePresensi,
    createAnnouncement,

    // CSV
    exportToCSV
  };

})(); // end IIFE