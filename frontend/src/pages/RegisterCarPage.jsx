import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useContract } from "../hooks/useContract";
import api from "../utils/api";
import { toChainCoord } from "../utils/format";
import { toast } from "react-toastify";
import styles from "./RegisterCarPage.module.css";

export default function RegisterCarPage() {
  const { send }    = useContract();
  const navigate    = useNavigate();
  const [loading,   setLoading]   = useState(false);
  const [images,    setImages]    = useState([]);
  const [registryFile, setRegistryFile] = useState(null);
  const [insuranceFile, setInsuranceFile] = useState(null);
  const [form,      setForm]      = useState({
    make:          "",
    model:         "",
    year:          "",
    color:         "",
    pricePerHour:  "",
    securityDeposit:"",
    lat:           "",
    lng:           "",
    description:   "",
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const autoLocate = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      set("lat", pos.coords.latitude.toFixed(6));
      set("lng", pos.coords.longitude.toFixed(6));
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.lat || !form.lng) { toast.error("Please add a pickup location"); return; }
    if (images.length === 0)    { toast.error("Please upload at least one car photo"); return; }
    if (!registryFile)          { toast.error("Please upload car registry document"); return; }
    if (!insuranceFile)         { toast.error("Please upload car insurance details"); return; }

    setLoading(true);
    try {
      // 1. Upload files to IPFS
      const fdImg = new FormData(); fdImg.append("file", images[0]);
      const { data: imgData } = await api.post("/ipfs/upload", fdImg, { headers: { "Content-Type": "multipart/form-data" } });

      const fdReg = new FormData(); fdReg.append("file", registryFile);
      const { data: regData } = await api.post("/ipfs/upload", fdReg, { headers: { "Content-Type": "multipart/form-data" } });

      const fdIns = new FormData(); fdIns.append("file", insuranceFile);
      const { data: insData } = await api.post("/ipfs/upload", fdIns, { headers: { "Content-Type": "multipart/form-data" } });

      // 2. Build metadata JSON and pin to IPFS
      const metadata = {
        make:        form.make,
        model:       form.model,
        year:        form.year,
        color:       form.color,
        description: form.description,
        image:       imgData.ipfsHash,
        imageUrl:    imgData.url,
        registryDoc: regData.ipfsHash,
        insuranceDoc: insData.ipfsHash,
        createdAt:   Date.now(),
      };
      const { data: metaData } = await api.post("/ipfs/upload-json", {
        data: metadata,
        name: `car-${form.make}-${form.model}`,
      });

      const metaURI       = `ipfs://${metaData.ipfsHash}`;
      const priceWei      = ethers.parseEther(form.pricePerHour);
      const depositWei    = ethers.parseEther(form.securityDeposit);
      const latChain      = toChainCoord(form.lat);
      const lngChain      = toChainCoord(form.lng);

      // 3. Register on-chain
      await send(
        "registerCar",
        [metaURI, priceWei, depositWei, latChain, lngChain],
        {},
        "Registering car on-chain"
      );

      toast.success("Car listed successfully!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.reason || err.message || "Failed to list car");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className="page-wrapper">
        <div className={styles.container}>
          <div className={styles.header}>
            <h1>List Your Car</h1>
            <p className="text-muted">Fill in your car details. Everything is stored on IPFS + blockchain.</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {/* Basic Info */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Car Details</h3>
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Make</label>
                  <input placeholder="e.g. Toyota" value={form.make} onChange={e => set("make", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Model</label>
                  <input placeholder="e.g. Corolla" value={form.model} onChange={e => set("model", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Year</label>
                  <input type="number" placeholder="e.g. 2020" value={form.year} onChange={e => set("year", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Color</label>
                  <input placeholder="e.g. Silver" value={form.color} onChange={e => set("color", e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 16 }}>
                <label className="form-label">Description</label>
                <textarea rows={3} placeholder="Any notes about the car (AC, GPS, etc.)"
                  value={form.description} onChange={e => set("description", e.target.value)}
                  style={{ resize: "vertical" }} />
              </div>
            </div>

            {/* Pricing */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Pricing</h3>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Price per Hour (ETH)</label>
                  <input type="number" step="0.0001" min="0.0001" placeholder="e.g. 0.01"
                    value={form.pricePerHour} onChange={e => set("pricePerHour", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Security Deposit (ETH)</label>
                  <input type="number" step="0.0001" min="0.0001" placeholder="e.g. 0.05"
                    value={form.securityDeposit} onChange={e => set("securityDeposit", e.target.value)} required />
                  <span className="form-hint">Returned to renter after successful rental (minus any fuel penalty).</span>
                </div>
              </div>
            </div>

            {/* Location */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Pickup Location</h3>
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input type="number" step="0.000001" placeholder="e.g. 22.5726"
                    value={form.lat} onChange={e => set("lat", e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input type="number" step="0.000001" placeholder="e.g. 88.3639"
                    value={form.lng} onChange={e => set("lng", e.target.value)} required />
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={autoLocate}>
                📍 Use My Current Location
              </button>
            </div>

            {/* Photos & Docs */}
            <div className="card">
              <h3 style={{ marginBottom: 20 }}>Car Documents & Photos</h3>
              
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Car Registry Document</label>
                <input type="file" accept="image/*,application/pdf"
                  onChange={e => setRegistryFile(e.target.files[0])}
                  style={{ padding: 8 }} required />
                <span className="form-hint">Required for admin verification.</span>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Car Insurance Details</label>
                <input type="file" accept="image/*,application/pdf"
                  onChange={e => setInsuranceFile(e.target.files[0])}
                  style={{ padding: 8 }} required />
                <span className="form-hint">Required for admin verification.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Upload Photos (JPG / PNG)</label>
                <input type="file" accept="image/*" multiple
                  onChange={e => setImages(Array.from(e.target.files))}
                  style={{ padding: 8 }} required />
                <span className="form-hint">First photo will be used as the main listing image. Stored on IPFS.</span>
              </div>
              {images.length > 0 && (
                <div className={styles.thumbs}>
                  {images.map((f, i) => (
                    <div key={i} className={styles.thumb}>
                      <img src={URL.createObjectURL(f)} alt="" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ width: "100%" }}>
              {loading ? <><span className="spinner" /> Listing Car…</> : "List Car on Blockchain →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
