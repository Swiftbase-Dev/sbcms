<template>
  <div class="space-y-8 max-w-4xl mx-auto animate-in fade-in duration-500">
    <!-- Header -->
    <div>
      <div class="badge bg-primary text-white border-none font-bold uppercase tracking-widest text-[9px] px-3 py-1">CMS Identity Profile</div>
      <h1 class="text-4xl font-black tracking-tighter">My Profile</h1>
      <p class="text-xs opacity-50 mt-1">Manage your administrator account details and security credentials.</p>
    </div>

    <!-- Main Container / Spinner -->
    <div v-if="loading" class="flex justify-center items-center py-20 bg-white dark:bg-slate-900 border border-base-200 rounded-3xl shadow-xl">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <div v-else class="grid gap-8 md:grid-cols-3">
      <!-- Profile Card Summary -->
      <div class="card bg-white dark:bg-slate-900 border border-base-200 p-6 rounded-3xl shadow-xl flex flex-col items-center text-center space-y-4 h-fit">
        <div class="w-24 h-24 rounded-full bg-primary/10 text-primary font-black text-4xl flex items-center justify-center border-4 border-primary/20 shadow-inner">
          {{ form.firstName ? form.firstName[0] : 'A' }}
        </div>
        <div>
          <h2 class="text-xl font-bold tracking-tight">{{ form.firstName }} {{ form.lastName }}</h2>
          <p class="text-xs opacity-50">{{ form.email }}</p>
        </div>
        <div class="badge badge-outline border-slate-300 dark:border-slate-800 font-mono text-[10px] py-2 uppercase">
          Administrator Role
        </div>
      </div>

      <!-- Settings Forms -->
      <div class="md:col-span-2 space-y-8">
        <!-- Edit Profile Form -->
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-8 rounded-3xl shadow-xl space-y-6">
          <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Personal Information</h3>
          
          <form @submit.prevent="updateUserProfile" class="space-y-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">First Name</label>
                <input type="text" v-model="form.firstName" class="input input-bordered rounded-xl w-full" required />
              </div>

              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">Last Name</label>
                <input type="text" v-model="form.lastName" class="input input-bordered rounded-xl w-full" required />
              </div>
            </div>

            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Email Address</label>
              <input type="email" v-model="form.email" class="input input-bordered rounded-xl w-full" required />
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="btn btn-primary rounded-xl px-8 font-bold text-xs uppercase tracking-wider text-white gap-2" :disabled="updatingProfile">
                <span v-if="updatingProfile" class="loading loading-spinner loading-xs"></span>
                Save Changes
              </button>
            </div>
          </form>
        </div>

        <!-- Change Password Form -->
        <div class="card bg-white dark:bg-slate-900 border border-base-200 p-8 rounded-3xl shadow-xl space-y-6">
          <h3 class="font-bold text-sm uppercase tracking-widest opacity-60">Update Security Password</h3>
          
          <form @submit.prevent="updateUserPassword" class="space-y-4">
            <div class="form-control">
              <label class="label font-bold text-xs uppercase text-slate-400">Current Password</label>
              <input type="password" v-model="passwordForm.oldPassword" placeholder="••••••••" class="input input-bordered rounded-xl w-full" required />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">New Password</label>
                <input type="password" v-model="passwordForm.newPassword" placeholder="••••••••" class="input input-bordered rounded-xl w-full" required />
              </div>

              <div class="form-control">
                <label class="label font-bold text-xs uppercase text-slate-400">Confirm New Password</label>
                <input type="password" v-model="passwordForm.confirmPassword" placeholder="••••••••" class="input input-bordered rounded-xl w-full" required />
              </div>
            </div>

            <div class="flex justify-end pt-2">
              <button type="submit" class="btn btn-outline rounded-xl px-8 font-bold text-xs uppercase tracking-wider gap-2" :disabled="updatingPassword">
                <span v-if="updatingPassword" class="loading loading-spinner loading-xs"></span>
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Reusable custom Modal for alerts/confirms -->
    <div v-if="modal.show" class="modal modal-open z-50">
      <div class="modal-box rounded-3xl border border-base-200 shadow-2xl bg-white dark:bg-slate-900">
        <h3 class="font-black text-2xl tracking-tight">{{ modal.title }}</h3>
        <p class="text-xs opacity-60 mt-2 mb-6">{{ modal.message }}</p>
        <div class="modal-action">
          <button type="button" @click="modal.show = false" class="btn btn-ghost rounded-xl font-bold">Ok</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";

const form = ref({
  firstName: "",
  lastName: "",
  email: "",
});

const passwordForm = ref({
  oldPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const loading = ref(true);
const updatingProfile = ref(false);
const updatingPassword = ref(false);

const modal = ref({
  show: false,
  title: "",
  message: "",
});

const showAlert = (title: string, message: string) => {
  modal.value = { show: true, title, message };
};

const fetchProfile = async () => {
  try {
    const res = await fetch("/api/profile");
    if (res.ok) {
      const data = await res.json();
      form.value = {
        firstName: data.firstName || "",
        lastName: data.lastName || "",
        email: data.email || "",
      };
    }
  } catch (err) {
    console.error("Failed to load profile:", err);
  } finally {
    loading.value = false;
  }
};

const updateUserProfile = async () => {
  updatingProfile.value = true;
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value),
    });
    if (res.ok) {
      showAlert("Success", "Profile updated successfully!");
      await fetchProfile();
    }
  } catch (err) {
    console.error("Failed to update profile:", err);
  } finally {
    updatingProfile.value = false;
  }
};

const updateUserPassword = async () => {
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    showAlert("Error", "New passwords do not match!");
    return;
  }

  updatingPassword.value = true;
  try {
    const res = await fetch("/api/profile/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oldPassword: passwordForm.value.oldPassword,
        newPassword: passwordForm.value.newPassword,
      }),
    });
    if (res.ok) {
      showAlert("Success", "Password updated successfully!");
      passwordForm.value = {
        oldPassword: "",
        newPassword: "",
        confirmPassword: "",
      };
    }
  } catch (err) {
    console.error("Failed to update password:", err);
  } finally {
    updatingPassword.value = false;
  }
};

onMounted(fetchProfile);
</script>
